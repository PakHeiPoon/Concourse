import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

TZ_CN = timezone(timedelta(hours=8))


def _today(offset_days: int = 0) -> str:
    return (datetime.now(TZ_CN) + timedelta(days=offset_days)).strftime("%Y-%m-%d")


def _now_iso(offset_hours: int = 0) -> str:
    return (datetime.now(TZ_CN) + timedelta(hours=offset_hours)).isoformat(timespec="seconds")


def execute_skill(skill_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    handler = SKILL_HANDLERS.get(skill_name)
    if handler:
        return handler(payload)
    return {"message": f"Skill '{skill_name}' executed successfully", "received_payload": payload}


# --------------- Hotel Skills ---------------

def _check_availability(p: Dict[str, Any]) -> Dict[str, Any]:
    check_in = p.get("check_in", _today(3))
    check_out = p.get("check_out", _today(5))
    return {
        "available": True,
        "rooms": [
            {
                "room_type": "deluxe",
                "room_name": {"zh": "豪华湖景房", "en": "Deluxe Lake View Room"},
                "price_per_night": {"amount": 1280, "currency": "CNY"},
                "max_guests": 2,
                "amenities": ["wifi", "breakfast", "lake_view", "bathtub"],
                "cancellation_policy": {
                    "free_cancel_before": f"{check_in}T18:00:00+08:00",
                    "penalty_after": {"amount": 640, "currency": "CNY"},
                },
                "remaining_count": 3,
            },
            {
                "room_type": "suite",
                "room_name": {"zh": "行政套房", "en": "Executive Suite"},
                "price_per_night": {"amount": 2680, "currency": "CNY"},
                "max_guests": 3,
                "amenities": ["wifi", "breakfast", "lake_view", "bathtub", "lounge_access", "minibar"],
                "cancellation_policy": {
                    "free_cancel_before": f"{check_in}T18:00:00+08:00",
                    "penalty_after": {"amount": 1340, "currency": "CNY"},
                },
                "remaining_count": 1,
            },
        ],
        "total_nights": 2,
        "taxes_included": True,
        "check_in": check_in,
        "check_out": check_out,
    }


def _get_rates(p: Dict[str, Any]) -> Dict[str, Any]:
    check_in = p.get("check_in", _today(3))
    return {
        "room_type": p.get("room_type", "deluxe"),
        "nightly_rates": [
            {"date": check_in, "amount": 1280, "currency": "CNY", "is_weekend": False},
            {"date": _today(4), "amount": 1480, "currency": "CNY", "is_weekend": True},
        ],
        "subtotal": 2760,
        "taxes_and_fees": 138,
        "total": 2898,
        "currency": "CNY",
        "includes_breakfast": True,
        "deposit_required": {"amount": 500, "currency": "CNY"},
    }


def _create_booking(p: Dict[str, Any]) -> Dict[str, Any]:
    booking_id = f"BK-{uuid.uuid4().hex[:8].upper()}"
    return {
        "booking_id": booking_id,
        "status": "pending_confirmation",
        "confirmation_deadline": _now_iso(offset_hours=4),
        "payment_url": f"https://pay.tourskill.local/booking/{booking_id}",
        "cancellation_policy": {"free_cancel_before": f"{_today(3)}T18:00:00+08:00"},
        "booking_hash": f"0x{uuid.uuid4().hex}",
    }


def _get_cancellation_policy(_p: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "policies": [
            {
                "room_type": "all",
                "rules": [
                    {
                        "condition": "cancel_before_48h",
                        "description": {"zh": "入住前48小时免费取消", "en": "Free cancellation 48h before check-in"},
                        "refund_percentage": 100,
                    },
                    {
                        "condition": "cancel_within_48h",
                        "description": {"zh": "入住前48小时内取消收取首晚房费", "en": "First night charge within 48h"},
                        "refund_percentage": 0,
                        "penalty": "first_night",
                    },
                    {
                        "condition": "no_show",
                        "description": {"zh": "未入住扣全款", "en": "Full charge for no-show"},
                        "refund_percentage": 0,
                    },
                ],
            }
        ]
    }


# --------------- Restaurant Skills ---------------

def _check_table_availability(p: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "available": True,
        "slots": [
            {
                "time": p.get("time", "18:00"),
                "seating": "window",
                "seating_name": {"zh": "临窗座位", "en": "Window seat"},
                "max_party": 4,
                "estimated_duration_minutes": 90,
                "deposit_required": False,
            },
            {
                "time": "18:30",
                "seating": "private_room",
                "seating_name": {"zh": "西湖厅包间", "en": "West Lake Private Room"},
                "max_party": 10,
                "estimated_duration_minutes": 120,
                "deposit_required": True,
                "deposit_amount": {"amount": 500, "currency": "CNY"},
                "minimum_spend": {"amount": 2000, "currency": "CNY"},
            },
        ],
        "business_hours": {"lunch": "11:00-14:00", "dinner": "17:00-21:30"},
    }


def _get_menu(p: Dict[str, Any]) -> Dict[str, Any]:
    items = [
        {
            "id": "sig-001",
            "name": {"zh": "西湖醋鱼", "en": "West Lake Fish in Vinegar Gravy"},
            "description": {
                "zh": "草鱼活杀现烹，糖醋浇汁，楼外楼百年经典",
                "en": "Fresh grass carp in sweet vinegar sauce, century-old house specialty",
            },
            "price": {"amount": 188, "currency": "CNY"},
            "serves": "2-3",
            "dietary_tags": ["gluten_free"],
            "allergens": ["fish"],
            "spicy_level": 0,
            "is_seasonal": False,
        },
        {
            "id": "sig-002",
            "name": {"zh": "龙井虾仁", "en": "Stir-fried Shrimp with Longjing Tea"},
            "description": {
                "zh": "明前龙井配鲜河虾仁，茶香四溢",
                "en": "River shrimp stir-fried with pre-Qingming Longjing tea leaves",
            },
            "price": {"amount": 168, "currency": "CNY"},
            "serves": "2-3",
            "dietary_tags": ["gluten_free"],
            "allergens": ["shellfish"],
            "spicy_level": 0,
            "is_seasonal": True,
            "available_months": [3, 4, 5],
        },
        {
            "id": "sig-003",
            "name": {"zh": "东坡肉", "en": "Dongpo Braised Pork Belly"},
            "description": {
                "zh": "杭帮菜经典代表，酥烂入味",
                "en": "Classic Hangzhou braised pork belly, meltingly tender",
            },
            "price": {"amount": 88, "currency": "CNY"},
            "serves": "1-2",
            "dietary_tags": [],
            "allergens": [],
            "spicy_level": 0,
            "is_seasonal": False,
        },
        {
            "id": "veg-001",
            "name": {"zh": "素烧鹅", "en": "Vegetarian Mock Goose"},
            "description": {
                "zh": "豆皮卷制，外酥里嫩，纯素可食",
                "en": "Crispy tofu skin roll, fully vegan",
            },
            "price": {"amount": 58, "currency": "CNY"},
            "serves": "2-3",
            "dietary_tags": ["vegetarian", "vegan", "gluten_free"],
            "allergens": ["soy"],
            "spicy_level": 0,
            "is_seasonal": False,
        },
    ]

    dietary_filter = p.get("dietary_filter", [])
    if dietary_filter:
        items = [i for i in items if any(t in i["dietary_tags"] for t in dietary_filter)]

    return {
        "restaurant_name": {"zh": "楼外楼", "en": "Louwailou"},
        "menu_version": "2026-Q2",
        "categories": [
            {
                "name": {"zh": "招牌菜", "en": "Signature Dishes"},
                "items": items,
            }
        ],
        "set_meals": [
            {
                "id": "set-001",
                "name": {"zh": "经典西湖宴", "en": "Classic West Lake Banquet"},
                "price_per_person": {"amount": 388, "currency": "CNY"},
                "min_guests": 4,
                "includes": ["sig-001", "sig-002", "sig-003"],
            }
        ],
    }


def _reserve_table(p: Dict[str, Any]) -> Dict[str, Any]:
    res_id = f"RES-{uuid.uuid4().hex[:8].upper()}"
    date = p.get("date", _today(1))
    time = p.get("time", "18:00")
    return {
        "reservation_id": res_id,
        "status": "confirmed",
        "details": {
            "date": date,
            "time": time,
            "party_size": p.get("party_size", 2),
            "seating": p.get("seating_preference", "window"),
            "hold_time_minutes": 15,
        },
        "pre_ordered_items": [],
        "cancellation": {
            "free_cancel_before": f"{date}T{str(int(time[:2]) - 2).zfill(2)}:00:00+08:00",
            "policy": {"zh": "用餐前2小时免费取消", "en": "Free cancellation 2 hours before dining"},
        },
        "reservation_hash": f"0x{uuid.uuid4().hex}",
    }


def _get_dietary_options(p: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "supported": ["vegetarian", "gluten_free", "shellfish_free"],
        "partially_supported": ["vegan"],
        "not_supported": ["halal", "kosher"],
        "details": {
            "vegetarian": {
                "available_items_count": 12,
                "description": {
                    "zh": "提供多款素菜，可定制素食套餐",
                    "en": "12 vegetarian options available, custom set meal on request",
                },
            },
            "vegan": {
                "available_items_count": 5,
                "description": {
                    "zh": "部分素菜可调整为纯素，请提前告知",
                    "en": "Some dishes can be made vegan with advance notice",
                },
            },
        },
        "allergen_handling": {
            "zh": "请在预订时说明过敏情况，厨房可针对性调整",
            "en": "Mention allergies when booking; kitchen can adjust accordingly",
        },
    }


# --------------- Attraction Skills ---------------

def _check_ticket_inventory(p: Dict[str, Any]) -> Dict[str, Any]:
    date = p.get("date", _today(2))
    return {
        "attraction_name": {"zh": "苏州拙政园", "en": "Humble Administrator's Garden, Suzhou"},
        "date": date,
        "tickets": [
            {
                "type": "adult",
                "name": {"zh": "成人票", "en": "Adult Ticket"},
                "price": {"amount": 70, "currency": "CNY"},
                "available": True,
                "remaining": 850,
                "time_slots": [
                    {"slot": "08:00-10:00", "remaining": 200},
                    {"slot": "10:00-12:00", "remaining": 150},
                    {"slot": "12:00-14:00", "remaining": 300},
                    {"slot": "14:00-16:00", "remaining": 200},
                ],
            },
            {
                "type": "student",
                "name": {"zh": "学生票", "en": "Student Ticket"},
                "price": {"amount": 35, "currency": "CNY"},
                "available": True,
                "remaining": 200,
                "requires_id": True,
                "id_note": {"zh": "入园需出示学生证", "en": "Student ID required at entry"},
            },
            {
                "type": "combo",
                "name": {"zh": "拙政园+苏州博物馆联票", "en": "Garden + Suzhou Museum Combo"},
                "price": {"amount": 90, "currency": "CNY"},
                "available": True,
                "remaining": 100,
                "includes": [
                    {"zh": "拙政园门票", "en": "Garden Entry"},
                    {"zh": "苏州博物馆免预约通道", "en": "Museum Fast Track Entry"},
                ],
            },
        ],
        "peak_warning": {
            "is_peak": True,
            "reason": {"zh": "周末，建议上午早场入园", "en": "Weekend — morning slots recommended"},
        },
    }


def _get_opening_hours(p: Dict[str, Any]) -> Dict[str, Any]:
    date = p.get("date", _today())
    return {
        "regular_hours": {
            "peak_season": {"period": "04-01 to 10-31", "open": "07:30", "close": "17:30", "last_entry": "17:00"},
            "off_season": {"period": "11-01 to 03-31", "open": "07:30", "close": "17:00", "last_entry": "16:30"},
        },
        "specific_date": {"date": date, "open": "07:30", "close": "17:30", "is_open": True, "special_note": None},
        "estimated_visit_duration": {
            "quick": {"minutes": 60, "zh": "快速游览", "en": "Quick tour"},
            "standard": {"minutes": 120, "zh": "常规游览", "en": "Standard visit"},
            "thorough": {"minutes": 180, "zh": "深度游览含茶室", "en": "In-depth tour with teahouse"},
        },
    }


def _purchase_ticket(p: Dict[str, Any]) -> Dict[str, Any]:
    order_id = f"TK-{uuid.uuid4().hex[:8].upper()}"
    tickets = p.get("tickets", [{"type": "adult", "quantity": 1}])
    total = sum(
        (70 if t.get("type") == "adult" else 35 if t.get("type") == "student" else 90) * t.get("quantity", 1)
        for t in tickets
    )
    return {
        "order_id": order_id,
        "status": "pending_payment",
        "tickets": [
            {"type": t["type"], "quantity": t.get("quantity", 1), "unit_price": 70 if t["type"] == "adult" else 35, "subtotal": (70 if t["type"] == "adult" else 35) * t.get("quantity", 1)}
            for t in tickets
        ],
        "total": {"amount": total, "currency": "CNY"},
        "payment_url": f"https://tickets.tourskill.local/pay/{order_id}",
        "payment_deadline": _now_iso(offset_hours=1),
        "entry_method": {"zh": "凭身份证原件或订单二维码入园", "en": "Enter with original ID or order QR code"},
        "refund_policy": {"zh": "未使用门票可在有效期前24小时申请全额退款", "en": "Full refund 24h before validity"},
        "order_hash": f"0x{uuid.uuid4().hex}",
    }


def _get_visitor_guide(_p: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "transport": {
            "metro": {"zh": "地铁4号线北寺塔站，步行约10分钟", "en": "Metro Line 4, Beisi Tower Station, ~10 min walk"},
            "bus": {"zh": "拙政园站：游1、游2、游5路、40路", "en": "Zhuozheng Yuan stop: Tourist 1/2/5, Bus 40"},
            "parking": {"zh": "东北街停车场，小型车10元/小时", "en": "Dongbei Street Parking, CNY 10/hr"},
        },
        "accessibility": {
            "wheelchair_accessible": True,
            "wheelchair_rental": True,
            "accessible_routes": {
                "zh": "主要游览路线有无障碍通道，部分假山区域不可达",
                "en": "Main routes wheelchair-accessible; some rockery areas not",
            },
        },
        "tips": [
            {"zh": "建议早上8点前入园，避开旅行团高峰", "en": "Arrive before 8 AM to avoid tour groups"},
            {"zh": "园内浮翠阁茶室可喝到碧螺春", "en": "Fucui Pavilion teahouse serves excellent Biluochun tea"},
        ],
        "nearby_recommendations": [
            {
                "name": {"zh": "苏州博物馆", "en": "Suzhou Museum"},
                "type": "attraction",
                "distance": "200m",
                "note": {"zh": "贝聿铭设计，免费但需预约", "en": "Designed by I.M. Pei, free but reservation required"},
            }
        ],
    }


SKILL_HANDLERS: Dict[str, Any] = {
    # Hotel
    "check_availability": _check_availability,
    "get_rates": _get_rates,
    "create_booking": _create_booking,
    "get_cancellation_policy": _get_cancellation_policy,
    # Restaurant
    "check_table_availability": _check_table_availability,
    "get_menu": _get_menu,
    "reserve_table": _reserve_table,
    "get_dietary_options": _get_dietary_options,
    # Attraction
    "check_ticket_inventory": _check_ticket_inventory,
    "get_opening_hours": _get_opening_hours,
    "purchase_ticket": _purchase_ticket,
    "get_visitor_guide": _get_visitor_guide,
}
