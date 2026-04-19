from typing import Any, Dict, List

FORM_SCHEMA: Dict[str, List[Dict[str, Any]]] = {
    "common": [
        {"key": "contact_phone", "label": "联系电话", "type": "text", "required": True},
        {"key": "contact_email", "label": "联系邮箱", "type": "email", "required": True},
        {"key": "address", "label": "详细地址", "type": "text", "required": True},
        {"key": "opening_hours", "label": "营业时间", "type": "text", "required": True},
        {"key": "price_level", "label": "价格等级(1-5)", "type": "number", "required": False},
        {"key": "tags", "label": "标签(逗号分隔)", "type": "array_text", "required": False},
        {"key": "languages_supported", "label": "支持语言(逗号分隔)", "type": "array_text", "required": False},
    ],
    "hotel": [
        {"key": "star_rating", "label": "星级", "type": "number", "required": False},
        {"key": "room_types", "label": "房型(逗号分隔)", "type": "array_text", "required": True},
        {"key": "check_in_time", "label": "入住时间", "type": "text", "required": True},
        {"key": "check_out_time", "label": "退房时间", "type": "text", "required": True},
        {"key": "breakfast_included", "label": "含早餐", "type": "boolean", "required": False},
        {"key": "parking_available", "label": "有停车位", "type": "boolean", "required": False},
    ],
    "restaurant": [
        {"key": "cuisine_type", "label": "菜系", "type": "text", "required": True},
        {"key": "signature_dishes", "label": "招牌菜(逗号分隔)", "type": "array_text", "required": True},
        {"key": "vegetarian_options", "label": "有素食选项", "type": "boolean", "required": False},
        {"key": "reservation_required", "label": "是否需预订", "type": "boolean", "required": False},
        {"key": "average_spend_per_person", "label": "人均消费(CNY)", "type": "number", "required": False},
    ],
    "attraction": [
        {"key": "ticket_types", "label": "票种(逗号分隔)", "type": "array_text", "required": True},
        {"key": "opening_seasons", "label": "开放季节", "type": "text", "required": False},
        {"key": "duration_hours", "label": "建议游玩时长(小时)", "type": "number", "required": False},
        {"key": "family_friendly", "label": "亲子友好", "type": "boolean", "required": False},
        {"key": "wheelchair_accessible", "label": "无障碍设施", "type": "boolean", "required": False},
    ],
    "shop": [
        {"key": "shop_category", "label": "商铺类别", "type": "text", "required": True},
        {"key": "main_products", "label": "主营商品(逗号分隔)", "type": "array_text", "required": True},
        {"key": "tax_refund_supported", "label": "支持退税", "type": "boolean", "required": False},
        {"key": "shipping_supported", "label": "支持寄送", "type": "boolean", "required": False},
    ],
}
