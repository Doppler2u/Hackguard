# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing
from dataclasses import dataclass


@allow_storage
@dataclass
class InsurancePolicy:
    policy_id: u256
    owner: Address
    protocol_name: str
    protocol_url: str
    coverage_amount_usd: u32
    premium_paid: bool
    is_active: bool
    created_at: str


@allow_storage
@dataclass
class HackClaim:
    claim_id: u256
    policy_id: u256
    claimant: Address
    evidence_url: str
    explorer_url: str
    description: str
    status: str
    severity: str
    confidence: u32
    loss_estimated_usd: u32
    analysis_summary: str
    attack_vector: str
    red_flags: str


class HackGuard(gl.Contract):
    next_policy_id: u256
    next_claim_id: u256
    policies: TreeMap[u256, InsurancePolicy]
    claims: TreeMap[u256, HackClaim]

    def __init__(self):
        self.next_policy_id = u256(0)
        self.next_claim_id = u256(0)

    # ──────────────────────────────────────────────
    #  POLICY MANAGEMENT
    # ──────────────────────────────────────────────

    @gl.public.write
    def register_policy(
        self,
        protocol_name: str,
        protocol_url: str,
        coverage_amount_usd: int,
        created_at: str,
    ) -> u256:
        policy_id = self.next_policy_id
        self.next_policy_id = u256(int(self.next_policy_id) + 1)
        self.policies[policy_id] = InsurancePolicy(
            policy_id=policy_id,
            owner=gl.message.sender_address,
            protocol_name=protocol_name,
            protocol_url=protocol_url,
            coverage_amount_usd=u32(coverage_amount_usd),
            premium_paid=True,
            is_active=True,
            created_at=created_at,
        )
        return policy_id

    @gl.public.write
    def deactivate_policy(self, policy_id: int) -> None:
        key = u256(policy_id)
        policy = self.policies[key]
        if policy.owner != gl.message.sender_address:
            raise gl.vm.UserError("only the policy owner can deactivate")
        policy.is_active = False
        self.policies[key] = policy

    @gl.public.view
    def get_policy(self, policy_id: int) -> dict[str, typing.Any]:
        policy = self.policies[u256(policy_id)]
        return self._policy_to_dict(policy)

    @gl.public.view
    def get_policy_count(self) -> u256:
        return self.next_policy_id

    # ──────────────────────────────────────────────
    #  CLAIM FILING & AI VERIFICATION
    # ──────────────────────────────────────────────

    @gl.public.write
    def file_claim(
        self,
        policy_id: int,
        evidence_url: str,
        explorer_url: str,
        description: str,
    ) -> dict[str, typing.Any]:
        policy_key = u256(policy_id)
        policy = self.policies[policy_key]
        if not policy.is_active:
            raise gl.vm.UserError("policy is not active")

        claim_id = self.next_claim_id
        self.next_claim_id = u256(int(self.next_claim_id) + 1)

        # Store PENDING claim before nondet block
        self.claims[claim_id] = HackClaim(
            claim_id=claim_id,
            policy_id=policy_key,
            claimant=gl.message.sender_address,
            evidence_url=evidence_url,
            explorer_url=explorer_url,
            description=description,
            status="PENDING",
            severity="NONE",
            confidence=u32(0),
            loss_estimated_usd=u32(0),
            analysis_summary="Pending AI investigation",
            attack_vector="Unknown",
            red_flags="",
        )

        protocol_name = str(policy.protocol_name)
        protocol_url = str(policy.protocol_url)

        def leader_fn() -> dict[str, typing.Any]:
            # 1. Fetch the evidence article / exploit report
            evidence_text = "Evidence URL unreachable"
            try:
                resp1 = gl.nondet.web.get(evidence_url)
                evidence_text = resp1.body.decode("utf-8")[:3000]
            except Exception:
                evidence_text = "Failed to fetch evidence URL"

            # 2. Fetch block explorer data
            explorer_text = "Explorer URL unreachable"
            try:
                resp2 = gl.nondet.web.get(explorer_url)
                explorer_text = resp2.body.decode("utf-8")[:3000]
            except Exception:
                explorer_text = "Failed to fetch explorer URL"

            # 3. LLM analysis
            prompt = f"""You are HackGuard, an autonomous AI insurance adjuster for DeFi protocol hacks.

INSURED PROTOCOL: {protocol_name}
PROTOCOL URL: {protocol_url}
INCIDENT DESCRIPTION: {description}

EVIDENCE ARTICLE / EXPLOIT REPORT:
{evidence_text}

BLOCK EXPLORER DATA:
{explorer_text}

YOUR TASK:
Analyze this incident and determine whether this is a GENUINE HACK/EXPLOIT or a FALSE ALARM (normal operation, planned migration, governance action, FUD, or user error).

Consider these factors:
- Is there verifiable evidence of unauthorized fund movement?
- Does the evidence describe a specific attack vector (reentrancy, flash loan, oracle manipulation, access control bypass, rugpull, private key compromise)?
- Are there multiple independent sources confirming the exploit?
- Could this be a normal protocol operation being misinterpreted?
- What is the estimated USD loss based on available data?

Respond ONLY as JSON with this exact shape:
{{
  "is_hack": true or false,
  "severity": "CRITICAL" or "HIGH" or "MEDIUM" or "LOW" or "NONE",
  "confidence": integer from 0 to 100,
  "loss_estimated_usd": integer estimate of losses in USD (0 if unknown or not a hack),
  "attack_vector": "reentrancy" or "flash_loan" or "oracle_manipulation" or "access_control" or "rugpull" or "key_compromise" or "logic_bug" or "unknown" or "none",
  "analysis_summary": "2-3 sentence explanation of your finding",
  "red_flags": "comma-separated list of suspicious indicators, or None"
}}"""

            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if isinstance(result, str):
                result = json.loads(
                    result.replace("```json", "").replace("```", "").strip()
                )

            is_hack = bool(result.get("is_hack", False))
            severity = str(result.get("severity", "NONE")).upper()
            if severity not in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"):
                severity = "NONE"
            confidence = int(result.get("confidence", 0))
            if confidence < 0:
                confidence = 0
            if confidence > 100:
                confidence = 100
            loss_estimated = int(result.get("loss_estimated_usd", 0))
            if loss_estimated < 0:
                loss_estimated = 0
            attack_vector = str(result.get("attack_vector", "unknown"))
            status = "APPROVED" if is_hack else "REJECTED"

            return {
                "is_hack": is_hack,
                "status": status,
                "severity": severity,
                "confidence": confidence,
                "loss_estimated_usd": loss_estimated,
                "attack_vector": attack_vector,
                "analysis_summary": str(result.get("analysis_summary", "")),
                "red_flags": str(result.get("red_flags", "None")),
            }

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            my_result = leader_fn()
            leader_result = leaders_res.calldata

            # Must agree on hack vs. not-hack
            if bool(my_result["is_hack"]) != bool(leader_result["is_hack"]):
                return False

            # Must agree on claim status
            if str(my_result["status"]) != str(leader_result["status"]):
                return False

            # Must agree on severity level
            if str(my_result["severity"]) != str(leader_result["severity"]):
                return False

            # Confidence within ±15 tolerance
            return (
                abs(int(my_result["confidence"]) - int(leader_result["confidence"]))
                <= 15
            )

        verdict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # Update claim with AI verdict (storage write OUTSIDE nondet block)
        self.claims[claim_id] = HackClaim(
            claim_id=claim_id,
            policy_id=policy_key,
            claimant=gl.message.sender_address,
            evidence_url=evidence_url,
            explorer_url=explorer_url,
            description=description,
            status=str(verdict["status"]),
            severity=str(verdict["severity"]),
            confidence=u32(int(verdict["confidence"])),
            loss_estimated_usd=u32(int(verdict["loss_estimated_usd"])),
            analysis_summary=str(verdict["analysis_summary"]),
            attack_vector=str(verdict["attack_vector"]),
            red_flags=str(verdict["red_flags"]),
        )

        return verdict

    @gl.public.view
    def get_claim(self, claim_id: int) -> dict[str, typing.Any]:
        claim = self.claims[u256(claim_id)]
        return self._claim_to_dict(claim)

    @gl.public.view
    def get_claim_count(self) -> u256:
        return self.next_claim_id

    # ──────────────────────────────────────────────
    #  HELPERS
    # ──────────────────────────────────────────────

    def _policy_to_dict(self, policy: InsurancePolicy) -> dict[str, typing.Any]:
        return {
            "policy_id": int(policy.policy_id),
            "owner": policy.owner,
            "protocol_name": policy.protocol_name,
            "protocol_url": policy.protocol_url,
            "coverage_amount_usd": int(policy.coverage_amount_usd),
            "premium_paid": policy.premium_paid,
            "is_active": policy.is_active,
            "created_at": policy.created_at,
        }

    def _claim_to_dict(self, claim: HackClaim) -> dict[str, typing.Any]:
        return {
            "claim_id": int(claim.claim_id),
            "policy_id": int(claim.policy_id),
            "claimant": claim.claimant,
            "evidence_url": claim.evidence_url,
            "explorer_url": claim.explorer_url,
            "description": claim.description,
            "status": claim.status,
            "severity": claim.severity,
            "confidence": int(claim.confidence),
            "loss_estimated_usd": int(claim.loss_estimated_usd),
            "analysis_summary": claim.analysis_summary,
            "attack_vector": claim.attack_vector,
            "red_flags": claim.red_flags,
        }
