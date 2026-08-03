import json
import sqlite3
from datetime import datetime

def reset_and_seed():
    conn = sqlite3.connect('sakan.db')
    cursor = conn.cursor()

    # 1. Clear old listings, ratings, complaints, bookmarks
    cursor.execute("DELETE FROM ratings")
    cursor.execute("DELETE FROM complaints")
    cursor.execute("DELETE FROM bookmarks")
    cursor.execute("DELETE FROM listings")
    cursor.execute("DELETE FROM users WHERE phone LIKE 'mock_%' OR account_type IN ('owner', 'broker')")

    conn.commit()

    # 2. Insert clean mock advertisers (owners & brokers)
    advertisers = [
        ("01011112222", "أحمد مصطفى (مالك مباشر)", "owner", True, True),
        ("01022223333", "مكتب الرواد العقاري (محمود حسن)", "broker", True, True),
        ("01033334444", "عمر الفاروق (مالك)", "owner", True, True),
        ("01044445555", "منى عبد الرحمن (سمسار عقاري)", "broker", True, False),
        ("01055556666", "إبراهيم السيد (مالك مباشر)", "owner", True, True),
    ]

    adv_ids = []
    for phone, name, acc_type, is_ver, sakan_ver in advertisers:
        cursor.execute("""
            INSERT INTO users (phone, name, account_type, is_verified, verified_by_sakan, is_banned, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)
        """, (phone, name, acc_type, is_ver, sakan_ver, datetime.utcnow()))
        adv_ids.append(cursor.lastrowid)

    conn.commit()

    # Stock high quality Unsplash photos for student housing
    photos_living = [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=80"
    ]
    photos_bedroom = [
        "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1540518614846-7ede433c5172?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80"
    ]
    photos_kitchen = [
        "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1000&q=80",
        "https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=1000&q=80"
    ]

    # 3. Create rich realistic mock listings
    mock_listings = [
        {
            "title": "شقة مفروشة فاخرة للطلاب بالدقي بالقرب من المترو",
            "governorate": "الجيزة",
            "city": "الجيزة",
            "neighborhood": "الدقي",
            "address": "الجيزة، الدقي، شارع التحرير، بالقرب من محطة مترو الدقي، عمارة 14",
            "floor": "3",
            "latitude": 30.0381,
            "longitude": 31.2118,
            "gender": "male",
            "available_beds": 4,
            "min_lease_months": 6,
            "tier": "premium",
            "advertiser_id": adv_ids[0],
            "contact_phone": "01011112222",
            "whatsapp_phone": "01011112222",
            "description": "شقة مفروشة بالكامل للطلاب بالقرب من جامعة القاهرة ومحطة مترو الدقي.\nالغرف واسعة ومجهزة بمكاتب مذاكرة ودواليب ملابس.\nالشقة مكيفة بالكامل وشاملة الإنترنت والمياه والكهرباء.",
            "room_configurations": [
              {"room_type": "single", "price_per_person": 2500, "commission": 0, "insurance_price": 1000, "services_inclusive": True, "count": 1},
              {"room_type": "double", "price_per_person": 1800, "commission": 0, "insurance_price": 800, "services_inclusive": True, "count": 2}
            ],
            "amenities": ["واي فاي مجاني", "تكييف", "مراوح", "سخان مياه", "ثلاجة", "غسالة", "بوتاجاز / ميكروويف", "فلتر مياه", "قريب من الجامعة", "قريب من المواصلات العامة", "سوبر ماركت", "مطاعم"],
            "photo_urls": [photos_living[0], photos_bedroom[0], photos_kitchen[0]]
        },
        {
            "title": "سكن طالبات متميز بجوار جامعة عين شمس (مدينة نصر)",
            "governorate": "القاهرة",
            "city": "القاهرة",
            "neighborhood": "مدينة نصر",
            "address": "القاهرة، مدينة نصر، الحي السابع، شارع عباس العقاد",
            "floor": "2",
            "latitude": 30.0561,
            "longitude": 31.3302,
            "gender": "female",
            "available_beds": 6,
            "min_lease_months": 9,
            "tier": "regular",
            "advertiser_id": adv_ids[1],
            "contact_phone": "01022223333",
            "whatsapp_phone": "01022223333",
            "description": "سكن طالبات هادئ وآمن جداً مع خدمات أمن وتنظيف دوري.\nيقع بالقرب من جامعة عين شمس وموقف مواصلات عباس العقاد.\nمباشر وبدون أي عمولة مع تجهيزات كاملة.",
            "room_configurations": [
              {"room_type": "double", "price_per_person": 2000, "commission": 500, "insurance_price": 1000, "services_inclusive": True, "count": 2},
              {"room_type": "triple", "price_per_person": 1500, "commission": 300, "insurance_price": 500, "services_inclusive": False, "count": 1}
            ],
            "amenities": ["واي فاي مجاني", "تكييف", "أمن 24 ساعة", "ثلاجة", "غسالة", "مكتب للمذاكرة", "قريب من الجامعة", "صيدلية", "سوبر ماركت"],
            "photo_urls": [photos_living[1], photos_bedroom[1], photos_kitchen[1]]
        },
        {
            "title": "استوديو مفروش حديثاً للطلاب بالإبراهيمية الإسكندرية",
            "governorate": "الإسكندرية",
            "city": "الإسكندرية",
            "neighborhood": "الإبراهيمية",
            "address": "الإسكندرية، الإبراهيمية، شارع اللاجتيه بالقرب من جامعة الإسكندرية",
            "floor": "4",
            "latitude": 31.2136,
            "longitude": 29.9234,
            "gender": "male",
            "available_beds": 2,
            "min_lease_months": 3,
            "tier": "regular",
            "advertiser_id": adv_ids[2],
            "contact_phone": "01033334444",
            "whatsapp_phone": "01033334444",
            "description": "استوديو مفروش حديثاً للإيجار للطلاب بالإبراهيمية بالقرب من المجمع النظري ومحطة الترماي.\nالشقة بحالة ممتازة ومجهزة بجميع الأجهزة الكهربائية وجاهزة للسكن الفوري.",
            "room_configurations": [
              {"room_type": "double", "price_per_person": 2200, "commission": 0, "insurance_price": 1000, "services_inclusive": True, "count": 1}
            ],
            "amenities": ["واي فاي مجاني", "سخان مياه", "ثلاجة", "بوتاجاز / ميكروويف", "غسالة", "مكتب للمذاكرة", "قريب من الجامعة", "مطاعم", "كافيهات"],
            "photo_urls": [photos_living[2], photos_bedroom[2]]
        },
        {
            "title": "شقة مفروشة لطالبات جامعة أسيوط (حي الجامعة)",
            "governorate": "أسيوط",
            "city": "أسيوط",
            "neighborhood": "حي الجامعة",
            "address": "أسيوط، حي الجامعة، شارع المكتبات خلف البوابة الرئيسية",
            "floor": "1",
            "latitude": 27.1856,
            "longitude": 31.1712,
            "gender": "female",
            "available_beds": 5,
            "min_lease_months": 9,
            "tier": "regular",
            "advertiser_id": adv_ids[3],
            "contact_phone": "01044445555",
            "whatsapp_phone": "01044445555",
            "description": "سكن طالبات هادئ ومريح خطوات من بوابة جامعة أسيوط الرئيسية.\nيتوفر بالمنزل مشرف لخدمات الصيانة والنظافة والراحة التامة للجميع.",
            "room_configurations": [
              {"room_type": "single", "price_per_person": 1800, "commission": 200, "insurance_price": 500, "services_inclusive": True, "count": 1},
              {"room_type": "double", "price_per_person": 1300, "commission": 150, "insurance_price": 300, "services_inclusive": True, "count": 2}
            ],
            "amenities": ["واي فاي مجاني", "مراوح", "سخان مياه", "ثلاجة", "غسالة", "مكتب للمذاكرة", "دواليب ملابس", "قريب من الجامعة", "محل طباعة وتصوير", "صيدلية"],
            "photo_urls": [photos_living[0], photos_bedroom[1]]
        },
        {
            "title": "شقة سكن طلاب بحي الجامعة بالمنصورة",
            "governorate": "الدقهلية",
            "city": "المنصورة",
            "neighborhood": "حي الجامعة",
            "address": "المنصورة، حي الجامعة، شارع جيهان بالقرب من كلية الطب",
            "floor": "5",
            "latitude": 31.0409,
            "longitude": 31.3578,
            "gender": "male",
            "available_beds": 3,
            "min_lease_months": 6,
            "tier": "premium",
            "advertiser_id": adv_ids[4],
            "contact_phone": "01055556666",
            "whatsapp_phone": "01055556666",
            "description": "شقة طلابية ممتازة في شارع جيهان الحيوي خطوات من كلية الطب والمستشفى الجامعي بالمنصورة.\nالعمارة حديثة وبها مصعد وأمن وتكييفات.",
            "room_configurations": [
              {"room_type": "single", "price_per_person": 2200, "commission": 0, "insurance_price": 500, "services_inclusive": True, "count": 1},
              {"room_type": "double", "price_per_person": 1600, "commission": 0, "insurance_price": 500, "services_inclusive": True, "count": 1}
            ],
            "amenities": ["واي فاي مجاني", "تكييف", "ثلاجة", "غسالة", "بوتاجاز / ميكروويف", "مكتب للمذاكرة", "مصعد", "قريب من الجامعة", "جيم (Gym)", "مطاعم"],
            "photo_urls": [photos_living[1], photos_bedroom[2]]
        },
        {
            "title": "غرف مفروشة راقية في فيلا بالشيخ زايد للطلاب",
            "governorate": "الجيزة",
            "city": "الشيخ زايد",
            "neighborhood": "الحي الأول",
            "address": "الجيزة، الشيخ زايد، الحي الأول، بالقرب من جامعة مصر للعلوم والتكنولوجيا",
            "floor": "1",
            "latitude": 30.0465,
            "longitude": 30.9854,
            "gender": "male",
            "available_beds": 2,
            "min_lease_months": 6,
            "tier": "premium",
            "advertiser_id": adv_ids[0],
            "contact_phone": "01011112222",
            "whatsapp_phone": "01011112222",
            "description": "غرف سنجل راقية في فيلا سكنية هادئة بالشيخ زايد، مناسبة لطلاب جامعة مصر ومصري والجامعة الكندية.\nبيئة ممتازة للمذاكرة والهدوء مع حديقة مشتركة.",
            "room_configurations": [
              {"room_type": "single", "price_per_person": 3500, "commission": 0, "insurance_price": 1500, "services_inclusive": True, "count": 2}
            ],
            "amenities": ["واي فاي مجاني", "تكييف", "ثلاجة", "ميكروويف", "غسالة", "مكتب للمذاكرة", "أمن 24 ساعة", "قريب من المواصلات العامة"],
            "photo_urls": [photos_living[2], photos_bedroom[0]]
        }
    ]

    for item in mock_listings:
        cursor.execute("""
            INSERT INTO listings (
                title, governorate, city, neighborhood, address, floor,
                latitude, longitude, gender, available_beds, min_lease_months,
                tier, advertiser_id, contact_phone, whatsapp_phone, description,
                room_configurations, amenities, photo_urls, status, view_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)
        """, (
            item["title"], item["governorate"], item["city"], item["neighborhood"], item["address"], item["floor"],
            item["latitude"], item["longitude"], item["gender"], item["available_beds"], item["min_lease_months"],
            item["tier"], item["advertiser_id"], item["contact_phone"], item["whatsapp_phone"], item["description"],
            json.dumps(item["room_configurations"]), json.dumps(item["amenities"]), json.dumps(item["photo_urls"]),
            datetime.utcnow()
        ))

    conn.commit()
    print(f"Successfully cleared old listings and seeded {len(mock_listings)} clean mock listings!")
    conn.close()

if __name__ == '__main__':
    reset_and_seed()
