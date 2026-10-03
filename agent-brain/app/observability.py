import os
import time
import json
import uuid
import httpx
import logging
from typing import Dict, Any, Optional, List
from contextlib import contextmanager

logger = logging.getLogger("chatbolt.brain.observability")

RUNTIME_OTLP_ENDPOINT = os.getenv("AGENT_RUNTIME_URL", "http://localhost:8081") + "/v1/traces"

class OTLPTracer:
    def __init__(self, service_name: str = "agent-brain"):
        self.service_name = service_name
        self.http_client = httpx.AsyncClient(timeout=2.0)

    def generate_trace_id(self) -> str:
        return uuid.uuid4().hex

    def generate_span_id(self) -> str:
        return uuid.uuid4().hex[:16]

    async def emit_span(
        self,
        run_id: str,
        span_id: str,
        parent_span_id: Optional[str],
        trace_id: str,
        name: str,
        span_type: str,
        start_time_ns: int,
        end_time_ns: int,
        status_code: int = 1, # 1 = OK, 2 = ERROR
        error_message: str = "",
        attributes: Optional[Dict[str, Any]] = None
    ):
        attrs = attributes or {}
        attrs["chatbolt.run_id"] = run_id
        attrs["chatbolt.span_type"] = span_type
        attrs["service.name"] = self.service_name

        otlp_attrs = [{"key": k, "value": v} for k, v in attrs.items()]

        payload = {
            "resourceSpans": [
                {
                    "resource": {
                        "attributes": [{"key": "service.name", "value": self.service_name}]
                    },
                    "scopeSpans": [
                        {
                            "spans": [
                                {
                                    "traceId": trace_id,
                                    "spanId": span_id,
                                    "parentSpanId": parent_span_id or "",
                                    "name": name,
                                    "kind": 1,
                                    "startTimeUnixNano": start_time_ns,
                                    "endTimeUnixNano": end_time_ns,
                                    "attributes": otlp_attrs,
                                    "status": {
                                        "code": status_code,
                                        "message": error_message
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        }

        try:
            headers = {"Content-Type": "application/json"}
            internal_secret = os.environ.get("INTERNAL_SERVICE_SECRET")
            if internal_secret:
                headers["X-Internal-Service-Key"] = internal_secret
            await self.http_client.post(RUNTIME_OTLP_ENDPOINT, json=payload, headers=headers)
        except Exception as e:
            logger.debug(f"Failed to forward OTLP span to runtime: {e}")

tracer = OTLPTracer()
