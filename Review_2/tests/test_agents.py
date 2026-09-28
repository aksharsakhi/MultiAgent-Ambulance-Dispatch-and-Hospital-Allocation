#!/usr/bin/env python3
"""
Unit tests for Multi-Agent Execution & FIPA-ACL Contract Net Protocol Interaction
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

    def register(self, agent_id: str, agent):
        self.registry[agent_id] = agent

    def send_direct(self, msg: ACLMessage):
        if msg.receiver in self.registry:
            self.registry[msg.receiver].receive_message(msg)

    def broadcast(self, msg: ACLMessage, target_group: str = "ambulances"):
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

if __name__ == "__main__":
    unittest.main()
