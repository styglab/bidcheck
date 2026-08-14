from app.schemas.check import BidCheckRequest, BidCheckResponse, CheckItem


class BidCheckService:
    @staticmethod
    def check(payload: BidCheckRequest) -> BidCheckResponse:
        checks = [
            BidCheckService._region(payload),
            BidCheckService._license(payload),
        ]
        results = {item.result for item in checks}
        status = "INELIGIBLE" if "FAIL" in results else "REVIEW_REQUIRED" if "UNKNOWN" in results else "ELIGIBLE"
        return BidCheckResponse(status=status, checks=checks)

    @staticmethod
    def _region(payload: BidCheckRequest) -> CheckItem:
        if not payload.required_region:
            return CheckItem(rule="지역 제한", result="PASS", reason="지역 제한이 없습니다.")
        if not payload.company_region:
            return CheckItem(rule="지역 제한", result="UNKNOWN", reason="회사 소재지 정보가 없습니다.")
        matched = payload.required_region == payload.company_region
        return CheckItem(rule="지역 제한", result="PASS" if matched else "FAIL", reason="요구 지역과 회사 소재지를 비교했습니다.")

    @staticmethod
    def _license(payload: BidCheckRequest) -> CheckItem:
        if not payload.required_license:
            return CheckItem(rule="면허", result="PASS", reason="필수 면허가 없습니다.")
        matched = payload.required_license in payload.company_licenses
        return CheckItem(rule="면허", result="PASS" if matched else "FAIL", reason="필수 면허 보유 여부를 확인했습니다.")

