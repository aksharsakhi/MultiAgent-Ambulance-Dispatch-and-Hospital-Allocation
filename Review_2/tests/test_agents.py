#!/usr/bin/env python3
"""
Unit tests for Multi-Agent Execution & FIPA-ACL Contract Net Protocol Interaction
Course: 23CSE301 Foundations of Artificial Intelligence · Amrita Vishwa Vidyapeetham

Rubric 2: Multi-Agent Execution & Interaction (3 Marks)
"""

import unittest
from unittest.mock import MagicMock
from Review_2.src.environment.city_graph import CityGraph
from Review_2.src.environment.incident_generator import EmergencyIncident, ESILevel
from Review_2.src.agents.messages import ACLMessage, ACLPerformative
from Review_2.src.agents.dispatcher_agent import DispatcherAgent
from Review_2.src.agents.ambulance_agent import AmbulanceAgent
from Review_2.src.agents.hospital_agent import HospitalAgent

import mesa

class MockMessageBus:
    def __init__(self):
        self.registry = {}
        self.sent_messages = []

    def register(self, agent_id: str, agent):
        self.registry[agent_id] = agent

    def send_direct(self, msg: ACLMessage):
        self.sent_messages.append(msg)
        if msg.receiver in self.registry:
            self.registry[msg.receiver].receive_message(msg)

    def broadcast(self, msg: ACLMessage, target_group: str = "ambulances"):
        self.sent_messages.append(msg)
        for a in self.registry.values():
            if isinstance(a, AmbulanceAgent):
                a.receive_message(msg)


class MockMesaModel(mesa.Model):
    def __init__(self):
        super().__init__()
        self.city_graph = CityGraph(rows=4, cols=4, block_spacing_m=1000.0)
        self.current_time_sec = 100.0
        self.time_step_sec = 5.0
        self.message_bus = MockMessageBus()
        self.incidents = {}

    def get_incident(self, inc_id: str):
        return self.incidents.get(inc_id)


class TestMultiAgentInteraction(unittest.TestCase):

    def setUp(self):
        self.model = MockMesaModel()
        self.dispatcher = DispatcherAgent("DISPATCHER-01", self.model, auction_timeout_sec=2.0)
        self.model.dispatcher = self.dispatcher
        self.model.message_bus.register(self.dispatcher.agent_id, self.dispatcher)

        # Create two ambulances: Amb 1 is closer (Node 0), Amb 2 is farther (Node 15)
        self.amb1 = AmbulanceAgent(
            "AMB-ALS-01", self.model, vehicle_type="ALS", base_node=0,
            speed_kmh=60.0, fuel_capacity_km=300.0,
            capabilities=["CARDIAC_MONITOR", "VENTILATOR", "INTUBATION"]
        )
        self.amb2 = AmbulanceAgent(
            "AMB-BLS-02", self.model, vehicle_type="BLS", base_node=15,
            speed_kmh=50.0, fuel_capacity_km=300.0,
            capabilities=["OXYGEN", "SPLINTING"]
        )
        self.model.message_bus.register(self.amb1.agent_id, self.amb1)
        self.model.message_bus.register(self.amb2.agent_id, self.amb2)

    def test_fipa_cnp_auction_lifecycle(self):
        """Test complete FIPA-ACL auction from CFP to dispatch award."""
        inc = EmergencyIncident(
            incident_id="TEST-INC-01",
            node_id=1, # Near Amb 1 at node 0
            pos=(1000.0, 0.0),
            esi_level=ESILevel.RESUSCITATION,
            specialty_needed="CARDIAC_CATH_LAB",
            spawn_time_sec=100.0,
            golden_hour_limit_sec=480.0
        )
        self.model.incidents[inc.incident_id] = inc

        # 1. Dispatcher announces incident via CFP
        self.dispatcher.announce_incident(inc)
        conv_id = f"AUCTION-{inc.incident_id}"
        self.assertIn(conv_id, self.dispatcher.active_auctions)

        # 2. Both ambulances step and process CFP
        self.amb1.step()
        self.amb2.step()

        # Dispatcher processes incoming PROPOSE bids
        self.dispatcher.step()
        bids = self.dispatcher.active_auctions[conv_id]["bids"]
        self.assertEqual(len(bids), 2)
        self.assertIn("AMB-ALS-01", bids)
        self.assertIn("AMB-BLS-02", bids)

        # 3. Fast-forward clock past auction timeout and step dispatcher
        self.model.current_time_sec += 5.0
        self.dispatcher.step()

        # Auction should be concluded and awarded to Amb 1 (closer + ALS capability)
        self.assertEqual(inc.status, "DISPATCHED")
        self.assertEqual(inc.assigned_ambulance_id, "AMB-ALS-01")

        # 4. Step ambulances to process ACCEPT / REJECT proposals
        self.amb1.step()
        self.amb2.step()

        self.assertEqual(self.amb1.state, "EN_ROUTE_SCENE")
        self.assertEqual(self.amb2.state, "IDLE")

    def test_ambulance_refuses_bidding_when_busy(self):
        """Verify that an ambulance already committed to an incident sends REFUSE for new CFPs."""
        # Put amb1 into EN_ROUTE_SCENE state with active incident
        mock_active = EmergencyIncident(
            incident_id="INC-ACTIVE",
            node_id=1,
            pos=(1000.0, 0.0),
            esi_level=ESILevel.URGENT,
            specialty_needed="GENERAL_SURGERY",
            spawn_time_sec=50.0,
            golden_hour_limit_sec=1800.0
        )
        self.amb1.active_incident = mock_active
        self.amb1.state = "EN_ROUTE_SCENE"
        self.amb1.current_path = [0, 1]
        self.amb1.target_node = 1

        cfp_msg = ACLMessage(
            performative=ACLPerformative.CFP,
            sender="DISPATCHER-01",
            receiver="AMB-ALS-01",
            conversation_id="AUCTION-BUSY-01",
            content={"node_id": 2, "specialty_needed": "GENERAL_SURGERY", "esi_level": 3, "pos": (2000.0, 0.0)}
        )
        self.amb1.receive_message(cfp_msg)
        self.amb1.step()

        # Check sent messages on bus: Amb 1 must have sent REFUSE
        refuse_msgs = [
            m for m in self.model.message_bus.sent_messages
            if m.sender == "AMB-ALS-01" and m.performative == ACLPerformative.REFUSE
        ]
        self.assertEqual(len(refuse_msgs), 1)
        self.assertEqual(refuse_msgs[0].content["reason"], "BUSY")

    def test_hems_air_ambulance_direct_line_speed(self):
        """Verify that HEMS air ambulance calculates straight-line flight time ignoring road network."""
        hems = AmbulanceAgent(
            "AMB-HELI-01", self.model, vehicle_type="HEMS", base_node=0,
            speed_kmh=180.0, fuel_capacity_km=400.0,
            capabilities=["FLIGHT_PHYSICIAN", "BLOOD_TRANSFUSION"],
            ignores_road_congestion=True
        )
        self.model.message_bus.register(hems.agent_id, hems)

        cfp_msg = ACLMessage(
            performative=ACLPerformative.CFP,
            sender="DISPATCHER-01",
            receiver="AMB-HELI-01",
            conversation_id="AUCTION-HEMS-01",
            content={"node_id": 15, "specialty_needed": "TRAUMA_SURGERY", "esi_level": 1, "pos": (3000.0, 3000.0)}
        )
        hems.receive_message(cfp_msg)
        hems.step()

        propose_msgs = [
            m for m in self.model.message_bus.sent_messages
            if m.sender == "AMB-HELI-01" and m.performative == ACLPerformative.PROPOSE
        ]
        self.assertEqual(len(propose_msgs), 1)
        eta = propose_msgs[0].content["eta_sec"]
        # Direct Euclidean distance from (0,0) to (3000, 3000) is sqrt(18e6) = 4242.64 m
        # At 180 km/h = 50 m/s: ETA ~ 84.85 seconds
        self.assertAlmostEqual(eta, 4242.64 / 50.0, delta=1.0)

    def test_hospital_agent_admit_and_discharge_capacity(self):
        """Verify HospitalAgent tracks ER bed occupancy, load percentage, and admission capacity."""
        hosp = HospitalAgent(
            unique_id="HOSP-TEST-01",
            model=self.model,
            name="Metro Trauma Center",
            node_id=5,
            trauma_level=1,
            er_capacity=10,
            icu_capacity=4,
            specialties=["TRAUMA_SURGERY", "CARDIAC_CATH_LAB"]
        )

        self.assertEqual(hosp.current_occupied_beds, 0)
        self.assertEqual(hosp.occupancy_rate, 0.0)

        # Admit 5 mock patients
        for i in range(5):
            mock_inc = EmergencyIncident(
                incident_id=f"INC-{i}",
                node_id=5,
                pos=(1000.0, 1000.0),
                esi_level=ESILevel.RESUSCITATION,
                specialty_needed="TRAUMA_SURGERY",
                spawn_time_sec=100.0,
                golden_hour_limit_sec=480.0
            )
            hosp.admit_patient(mock_inc)

        self.assertEqual(hosp.current_occupied_beds, 5)
        self.assertEqual(hosp.occupancy_rate, 50.0)
        self.assertFalse(hosp.is_diverting)

    def test_dispatcher_handles_no_bids_with_retry(self):
        """Verify that Dispatcher handles an auction with zero bids by recording a failed auction and rescheduling."""
        inc = EmergencyIncident(
            incident_id="INC-NO-BIDS",
            node_id=2,
            pos=(2000.0, 0.0),
            esi_level=ESILevel.EMERGENT,
            specialty_needed="GENERAL_SURGERY",
            spawn_time_sec=100.0,
            golden_hour_limit_sec=840.0
        )
        self.model.incidents[inc.incident_id] = inc
        self.dispatcher.announce_incident(inc)
        conv_id = f"AUCTION-{inc.incident_id}"

        # Clock past deadline with no bids submitted
        self.model.current_time_sec += 5.0
        self.dispatcher.step()

        self.assertEqual(self.dispatcher.failed_auctions_count, 1)
        # Auction remains active for retry
        self.assertIn(conv_id, self.dispatcher.active_auctions)

if __name__ == "__main__":
    unittest.main()
