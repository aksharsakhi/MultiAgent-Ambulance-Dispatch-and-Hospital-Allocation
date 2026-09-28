"""
FIPA-ACL Standard Communication Protocol & Messages
Module 02: Environment Taxonomy & Multi-Agent Interaction Protocols

Specification:
- Implements Foundation for Intelligent Physical Agents (FIPA) Agent Communication Language (ACL).
- Performatives:
    * CFP (Call for Proposal): Initiator requests bids on emergency incident
    * PROPOSE: Ambulance submits bid cost & ETA
    * REFUSE: Ambulance declines (e.g. busy or out of fuel)
    * ACCEPT_PROPOSAL: Dispatcher awards incident to winning ambulance
    * REJECT_PROPOSAL: Dispatcher rejects non-winning bids
    * INFORM: Notification of state transitions (e.g. on scene, patient delivered)
    * REQUEST: Direct request (e.g. hospital pre-notification or diversion request)
"""

from enum import Enum
from typing import Any, Dict, Optional
from dataclasses import dataclass, field
import time

class ACLPerformative(Enum):
    CFP = "CFP"                         # Call For Proposal
    PROPOSE = "PROPOSE"                 # Bid Submission
    REFUSE = "REFUSE"                   # Refusal to Bid
    ACCEPT_PROPOSAL = "ACCEPT_PROPOSAL" # Dispatch Award
    REJECT_PROPOSAL = "REJECT_PROPOSAL" # Bid Rejection
    INFORM = "INFORM"                   # State Change Notification
    REQUEST = "REQUEST"                 # Direct Action Request
    CONFIRM = "CONFIRM"                 # Agreement Confirmation

@dataclass
class ACLMessage:
    performative: ACLPerformative
    sender: str
    receiver: str
    conversation_id: str
    content: Dict[str, Any]
    protocol: str = "fipa-contract-net"
    ontology: str = "emergency-medical-dispatch"
    timestamp: float = field(default_factory=time.time)
    reply_with: Optional[str] = None
    in_reply_to: Optional[str] = None

    def __repr__(self) -> str:
        return (
            f"FIPA-ACL({self.performative.value} | from={self.sender} to={self.receiver} | "
            f"conv={self.conversation_id} | content={self.content})"
        )
