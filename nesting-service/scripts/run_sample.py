from __future__ import annotations

import json
import time
from pathlib import Path

import requests


BASE = "http://localhost:8010"


def main() -> None:
    payload_path = Path(__file__).resolve().parents[1] / "samples" / "sample_job.json"
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    create = requests.post(f"{BASE}/nest/jobs", json=payload, timeout=20)
    create.raise_for_status()
    job = create.json()
    jid = job["jobId"]
    print("job:", jid)
    while True:
        st = requests.get(f"{BASE}/nest/jobs/{jid}", timeout=20)
        st.raise_for_status()
        s = st.json()
        print("status:", s["status"])
        if s["status"] in ("completed", "failed"):
            break
        time.sleep(1.2)
    if s["status"] == "completed":
        res = requests.get(f"{BASE}/nest/jobs/{jid}/result", timeout=30)
        res.raise_for_status()
        data = res.json()
        print(
            "done",
            {
                "totalSheets": data["totalSheets"],
                "totalPlacedParts": data["totalPlacedParts"],
                "totalUnplacedParts": data["totalUnplacedParts"],
                "totalUtilization": data["totalUtilization"],
            },
        )
    else:
        print("job failed:", s.get("error"))


if __name__ == "__main__":
    main()
