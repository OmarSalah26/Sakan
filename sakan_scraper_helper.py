"""
sakan_scraper_helper.py
========================
Python Helper & Formatter for Scraped Ads -> Sakan Platform Ingestion.

Converts messy scraped ad dictionaries (from Telegram, Facebook, OLX, WhatsApp)
into 100% identical, validated JSON schema compatible with Sakan's backend
(`ListingCreate` Pydantic model & `POST /listings/bulk` endpoint).

Usage:
    from sakan_scraper_helper import format_scraped_listing, export_to_sakan_json

    formatted_ad = format_scraped_listing(raw_scraped_ad_dict)
    export_to_sakan_json([formatted_ad], "scraped_ads_formatted.json")
"""

import sys
import json
import re
from typing import List, Dict, Any, Optional
from datetime import datetime

# Set stdout encoding for Windows terminals
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


# ── Standard Amenities Mapping ──────────────────────────────────────────────
AMENITIES_MAP = {
  "نت": "wifi", "إنترنت": "wifi", "انترنت": "wifi", "واي فاي": "wifi", "wifi": "wifi",
  "تكييف": "ac", "مكيف": "ac", "ac": "ac",
  "غسالة": "washing_machine", "غساله": "washing_machine", "غسالة اوتوماتيك": "washing_machine", "washing_machine": "washing_machine",
  "مصعد": "elevator", "اسانسير": "elevator", "أسانسير": "elevator", "elevator": "elevator",
  "أمن": "security", "حراسة": "security", "امن": "security", "security": "security",
  "مياه": "water", "ماء": "water", "water": "water",
  "كهرباء": "electricity", "electricity": "electricity",
  "غاز": "gas", "غاز طبيعي": "gas", "gas": "gas",
  "بلكونة": "balcony", "تراس": "balcony", "balcony": "balcony",
  "ثلاجة": "fridge", "تلاجة": "fridge", "fridge": "fridge",
  "مطبخ": "kitchen", "kitchen": "kitchen",
  "سخان": "heater", "heater": "heater"
}

VALID_ROOM_TYPES = {"single", "double", "triple", "quad", "shared"}


def clean_phone_number(phone_raw: Optional[str]) -> Optional[str]:
    """Cleans phone numbers into clean string digits format."""
    if not phone_raw:
        return None
    cleaned = re.sub(r"[^\d+]", "", str(phone_raw))
    return cleaned if len(cleaned) >= 8 else None


def normalize_gender(gender_raw: Any, raw_text: str = "") -> str:
    """Ensures gender is strictly 'male' or 'female'."""
    text_check = (str(gender_raw) + " " + raw_text).lower()
    if any(w in text_check for w in ["female", "طالبات", "بنات", "فتيات", "بنت"]):
        return "female"
    return "male"


def parse_amenities(raw_amenities: Any, raw_text: str = "") -> List[str]:
    """Extracts and normalizes standardized amenity codes."""
    found = set()
    
    if isinstance(raw_amenities, list):
        for item in raw_amenities:
            if isinstance(item, str):
                item_clean = item.strip().lower()
                for key, std_code in AMENITIES_MAP.items():
                    if key in item_clean:
                        found.add(std_code)
            elif isinstance(item, dict) and "name" in item:
                name_clean = item["name"].strip().lower()
                for key, std_code in AMENITIES_MAP.items():
                    if key in name_clean:
                        found.add(std_code)

    text_lower = raw_text.lower()
    for key, std_code in AMENITIES_MAP.items():
        if key in text_lower:
            found.add(std_code)
            
    return list(found)


def build_room_configurations(raw_data: Dict[str, Any], base_price: float) -> List[Dict[str, Any]]:
    """
    Builds the room_configurations list.
    
    Commission Logic:
    - If fixed commission is explicitly specified (e.g. commission=500): set fixed commission.
    - If "no commission" or "0" is specified: set commission=0.
    - If commission is missing / null (default scraped state):
        set commission_type="range" with default 30%-100% range:
        commission_min_pct=30, commission_max_pct=100,
        commission_min = round(price * 0.30), commission_max = round(price * 1.00),
        commission = None.
    """
    existing_configs = raw_data.get("room_configurations") or []
    
    raw_comm = raw_data.get("commission")
    raw_comm_type = raw_data.get("commission_type")

    if isinstance(existing_configs, list) and len(existing_configs) > 0:
        cleaned_configs = []
        for config in existing_configs:
            rtype = config.get("room_type", "single")
            if rtype not in VALID_ROOM_TYPES:
                rtype = "single"
            
            p_price = float(config.get("price_per_person") or base_price or 1000)
            
            comm_val = config.get("commission", raw_comm)
            comm_type = config.get("commission_type", raw_comm_type)

            if comm_type == "fixed" or (isinstance(comm_val, (int, float)) and comm_val >= 0):
                c_item = {
                    "room_type": rtype,
                    "price_per_person": p_price,
                    "commission": float(comm_val) if comm_val is not None else round(p_price * 0.50),
                    "commission_type": "fixed",
                    "count": int(config.get("count", 1)),
                    "has_ac": bool(config.get("has_ac")) if config.get("has_ac") is not None else None,
                    "insurance_price": float(config.get("insurance_price")) if config.get("insurance_price") is not None else None,
                    "services_inclusive": bool(config.get("services_inclusive", False))
                }
            else:
                min_pct = float(config.get("commission_min_pct") or 30)
                max_pct = float(config.get("commission_max_pct") or 100)
                c_item = {
                    "room_type": rtype,
                    "price_per_person": p_price,
                    "commission_type": "range",
                    "commission_min_pct": min_pct,
                    "commission_max_pct": max_pct,
                    "commission_min": round(p_price * (min_pct / 100)),
                    "commission_max": round(p_price * (max_pct / 100)),
                    "commission": None,
                    "count": int(config.get("count", 1)),
                    "has_ac": bool(config.get("has_ac")) if config.get("has_ac") is not None else None,
                    "insurance_price": float(config.get("insurance_price")) if config.get("insurance_price") is not None else None,
                    "services_inclusive": bool(config.get("services_inclusive", False))
                }
            cleaned_configs.append(c_item)
        return cleaned_configs

    primary_room_type = raw_data.get("room_type") or "single"
    if primary_room_type not in VALID_ROOM_TYPES:
        primary_room_type = "single"

    if raw_comm_type == "fixed" or (isinstance(raw_comm, (int, float)) and raw_comm >= 0):
        return [{
            "room_type": primary_room_type,
            "price_per_person": base_price,
            "commission": float(raw_comm),
            "commission_type": "fixed",
            "count": 1,
            "has_ac": None,
            "insurance_price": None,
            "services_inclusive": False
        }]
    
    full_text = str(raw_data.get("description", "")) + " " + str(raw_data.get("title", ""))
    if "بدون عمولة" in full_text or "بدون عموله" in full_text or raw_comm == 0:
        return [{
            "room_type": primary_room_type,
            "price_per_person": base_price,
            "commission": 0,
            "commission_type": "fixed",
            "count": 1,
            "has_ac": None,
            "insurance_price": None,
            "services_inclusive": False
        }]

    # Default Null state: 30% - 100% Range
    return [{
        "room_type": primary_room_type,
        "price_per_person": base_price,
        "commission_type": "range",
        "commission_min_pct": 30,
        "commission_max_pct": 100,
        "commission_min": round(base_price * 0.30),
        "commission_max": round(base_price * 1.00),
        "commission": None,
        "count": 1,
        "has_ac": None,
        "insurance_price": None,
        "services_inclusive": False
    }]


def format_scraped_listing(raw: Dict[str, Any]) -> Dict[str, Any]:
    """
    Takes raw scraped dictionary and formats it to 100% compliant Sakan JSON listing.
    """
    raw_desc = str(raw.get("description") or "")
    raw_title = str(raw.get("title") or "سكن طلاب")
    
    governorate = str(raw.get("governorate") or "الجيزة").strip()
    city = str(raw.get("city") or raw.get("district") or governorate).strip()
    neighborhood = str(raw.get("neighborhood") or raw.get("street_and_landmarks") or city).strip()
    
    address = str(raw.get("address") or raw.get("full_address") or f"{governorate}، {city}، {neighborhood}").strip()

    base_price = float(raw.get("price_per_person") or raw.get("monthly_rent_egp") or raw.get("single_room_price_egp") or 1000)
    gender = normalize_gender(raw.get("gender") or raw.get("target_tenant"), raw_desc)

    phone = clean_phone_number(raw.get("contact_phone") or raw.get("contact_number") or raw.get("whatsapp_phone"))
    whatsapp = clean_phone_number(raw.get("whatsapp_phone") or phone)

    configs = build_room_configurations(raw, base_price)

    beds = raw.get("available_beds") or raw.get("beds_count")
    if beds is None or int(beds) <= 0:
        beds = sum(
            c.get("count", 1) * (2 if c.get("room_type") == "double" else 3 if c.get("room_type") == "triple" else 4 if c.get("room_type") == "quad" else 1)
            for c in configs
        )

    amenities = parse_amenities(raw.get("amenities"), raw_desc)

    photo_urls = raw.get("photo_urls") or []
    if isinstance(photo_urls, str):
        try:
            photo_urls = json.loads(photo_urls)
        except Exception:
            photo_urls = [photo_urls]

    formatted_ad = {
        "title": raw_title,
        "governorate": governorate,
        "city": city,
        "neighborhood": neighborhood,
        "address": address,
        "full_address": address,
        "street": raw.get("street"),
        "building_number": raw.get("building_number"),
        "apartment_number": raw.get("apartment_number"),
        "floor": str(raw.get("floor")) if raw.get("floor") is not None else None,
        "maps_link": raw.get("maps_link") or raw.get("map_link"),
        "latitude": float(raw["latitude"]) if raw.get("latitude") is not None else None,
        "longitude": float(raw["longitude"]) if raw.get("longitude") is not None else None,
        "location_precise": bool(raw.get("location_precise", False)),
        "gender": gender,
        "available_beds": int(beds),
        "price_per_person": int(configs[0]["price_per_person"]) if configs else int(base_price),
        "room_type": configs[0]["room_type"] if configs else "single",
        "room_configurations": configs,
        "amenities": amenities,
        "photo_urls": photo_urls,
        "cover_photo_index": int(raw.get("cover_photo_index", 0)),
        "video_urls": raw.get("video_urls") or [],
        "description": raw_desc,
        "contact_phone": phone,
        "whatsapp_phone": whatsapp,
        "advertiser_name": raw.get("advertiser_name") or raw.get("broker_name") or raw.get("organization_name"),
        "min_lease_months": int(raw["min_lease_months"]) if raw.get("min_lease_months") else None,
        "tier": raw.get("tier", "regular"),
        "status": "active",
        "source": raw.get("source", "scraped"),
        "full_edit_available": False
    }

    return formatted_ad


def export_to_sakan_json(scraped_items: List[Dict[str, Any]], output_filepath: str = "sakan_scraped_listings.json"):
    """Formats list of raw scraped dictionaries and exports to JSON file."""
    formatted_items = [format_scraped_listing(item) for item in scraped_items]
    with open(output_filepath, "w", encoding="utf-8") as f:
        json.dump(formatted_items, f, ensure_ascii=False, indent=2)
    print(f"Successfully formatted {len(formatted_items)} listings and exported to '{output_filepath}'.")
    return formatted_items


if __name__ == "__main__":
    sample_raw_ad = {
        "title": "شقة سكن طلاب بالدقي بجوار الجامعة",
        "description": "شقة طلابية مكيفة وفيها نت وغسالة اتوماتيك وأمن ٢٤ ساعة. الإيجار 2500 للسرير.",
        "governorate": "الجيزة",
        "city": "الدقي",
        "neighborhood": "بجوار جامعة القاهرة",
        "address": "12 شارع النيل، الدقي",
        "target_tenant": "شباب",
        "monthly_rent_egp": 2500,
        "contact_phone": "01011111111",
        "photo_urls": [
            "https://example.com/img1.jpg",
            "https://example.com/img2.jpg"
        ],
        "amenities": ["تكييف", "نت", "غسالة"]
    }

    result = format_scraped_listing(sample_raw_ad)
    print(json.dumps(result, ensure_ascii=False, indent=2))
