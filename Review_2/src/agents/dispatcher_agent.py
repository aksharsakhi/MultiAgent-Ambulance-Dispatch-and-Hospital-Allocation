"""
Regional 911 CAD Dispatcher Agent
Module 01: PEAS Formulation (Dispatcher Agent) & FIPA Contract Net Protocol

Role:
- Initiator in the FIPA Contract Net Protocol (CNP).
- Manages 911 emergency call triage queues.
- Broadcasts Calls for Proposals (CFP) to all distributed fleet units.
- Evaluates submitted bids based on Multi-Attribute Utility Theory (MAUT):
    U(bid) = - (w_t * ETA_min + w_e * SpecialtyMismatchPenalty + w_f * FuelCost)
- Awards dispatch contract to the Pareto-optimal ambulance.
- Requests two-sided Gale-Shapley matching for hospital bed allocation.
"""

from typing import Dict, List, Any, Optional
import mesa
from .messages import ACLMessage, ACLPerformative
from ..environment.incident_generator import EmergencyIncident, ESILevel

class DispatcherAgent(mesa.Agent):
    """
    Intelligent CAD Dispatcher coordinating fleet auctions and allocation.
    """

    def __init__(
        self,
        unique_id: str,
        model,
        weight_time: float = 0.60,
        weight_capability: float = 0.30,
        weight_fuel: float = 0.10,
        auction_timeout_sec: float = 3.0
    ):
        super().__init__(model)
        self.agent_id = unique_id
        self.w_t = weight_time
        self.w_e = weight_capability
        self.w_f = weight_fuel
        self.auction_timeout = auction_timeout_sec

        # Active auctions: conversation_id -> auction_data dict
        self.active_auctions: Dict[str, Dict[str, Any]] = {}
        self.inbox: List[ACLMessage] = []

        # Telemetry stats
        self.total_calls_handled = 0
        self.total_dispatches_awarded = 0
        self.failed_auctions_count = 0

    def receive_message(self, msg: ACLMessage):
        self.inbox.append(msg)

    def announce_incident(self, incident: EmergencyIncident):
        """Initiates a FIPA-ACL Contract Net Protocol auction for an incident."""
        conv_id = f"AUCTION-{incident.incident_id}"
        incident.status = "IN_AUCTION"

        self.active_auctions[conv_id] = {
            "incident": incident,
            "bids": {}, # ambulance_id -> bid_dict
            "opened_at_sec": self.model.current_time_sec,
            "deadline_sec": self.model.current_time_sec + self.auction_timeout
        }
        self.total_calls_handled += 1

        # Broadcast CFP to all ambulances
        cfp_msg = ACLMessage(
            performative=ACLPerformative.CFP,
            sender=self.agent_id,
            receiver="BROADCAST_AMBULANCES",
            conversation_id=conv_id,
            content={
                "incident_id": incident.incident_id,
                "node_id": incident.node_id,
                "pos": incident.pos,
                "esi_level": incident.esi_level.value,
                "specialty_needed": incident.specialty_needed,
                "spawn_time_sec": incident.spawn_time_sec
            },
            protocol="fipa-contract-net"
        )
        self.model.message_bus.broadcast(cfp_msg, target_group="ambulances")

    def step(self):
        # 1. Process Inbox Messages
        while self.inbox:
            msg = self.inbox.pop(0)
            self._handle_message(msg)

        # 2. Check and Conclude Expired Auctions
        current_time = self.model.current_time_sec
        expired_convs = [
            cid for cid, d in self.active_auctions.items()
            if current_time >= d["deadline_sec"]
        ]

        for cid in expired_convs:
            self._evaluate_and_award_auction(cid)

    def _handle_message(self, msg: ACLMessage):
        if msg.performative == ACLPerformative.PROPOSE:
            cid = msg.conversation_id
            if cid in self.active_auctions:
                self.active_auctions[cid]["bids"][msg.sender] = msg.content
        elif msg.performative == ACLPerformative.REFUSE:
            # Ambulance declined to bid
            pass
        elif msg.performative == ACLPerformative.INFORM:
            # State update from ambulance (e.g. arrived on scene or at hospital)
            action = msg.content.get("action")
            inc_id = msg.content.get("incident_id")
            if action == "ON_SCENE":
                inc = self.model.get_incident(inc_id)
                if inc:
                    inc.status = "ON_SCENE"
                    inc.on_scene_time_sec = self.model.current_time_sec
            elif action == "DELIVERED":
                inc = self.model.get_incident(inc_id)
                if inc:
                    inc.status = "RESOLVED"
                    inc.hospital_admit_time_sec = self.model.current_time_sec

    def _evaluate_and_award_auction(self, conv_id: str):
        auction = self.active_auctions.pop(conv_id, None)
        if not auction:
            return

        incident = auction["incident"]
        bids = auction["bids"]

        if not bids:
            # No bids received (all units busy), retry auction on next cycle
            self.failed_auctions_count += 1
            auction["deadline_sec"] = self.model.current_time_sec + self.auction_timeout
            self.active_auctions[conv_id] = auction
            return

        # Evaluate Multi-Attribute Utility Score for each bid
        best_amb_id = None
        best_score = float('inf') # Lower is better (Cost function)

        for amb_id, bdata in bids.items():
            eta_min = bdata.get("eta_sec", 600.0) / 60.0
            capability_penalty = bdata.get("capability_penalty", 0.0)
            fuel_penalty = bdata.get("fuel_penalty", 0.0)

            # Combined cost score
            score = (
                self.w_t * eta_min +
                self.w_e * capability_penalty +
                self.w_f * fuel_penalty
            )

            if score < best_score:
                best_score = score
                best_amb_id = amb_id

        # Award Contract to Best Bidder
        self.total_dispatches_awarded += 1
        incident.status = "DISPATCHED"
        incident.assigned_ambulance_id = best_amb_id
        incident.dispatched_time_sec = self.model.current_time_sec

        # Send ACCEPT_PROPOSAL to winner
        accept_msg = ACLMessage(
            performative=ACLPerformative.ACCEPT_PROPOSAL,
            sender=self.agent_id,
            receiver=best_amb_id,
            conversation_id=conv_id,
            content={
                "incident_id": incident.incident_id,
                "node_id": incident.node_id,
                "pos": incident.pos,
                "esi_level": incident.esi_level.value,
                "specialty_needed": incident.specialty_needed
            }
        )
        self.model.message_bus.send_direct(accept_msg)

        # Send REJECT_PROPOSAL to other bidders
        for amb_id in bids.keys():
            if amb_id != best_amb_id:
                reject_msg = ACLMessage(
                    performative=ACLPerformative.REJECT_PROPOSAL,
                    sender=self.agent_id,
                    receiver=amb_id,
                    conversation_id=conv_id,
                    content={"incident_id": incident.incident_id}
                )
                self.model.message_bus.send_direct(reject_msg)
