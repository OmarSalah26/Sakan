"""
seed_data.py – Populates the Sakan database with realistic sample listings.
Run once from the /backend directory:
    python3 seed_data.py
"""
import sys, json, random
from pathlib import Path
from datetime import datetime, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.main import Base, engine, SessionLocal, User, Listing

# ── Recreate tables ──────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Helper: create user directly (bypass OTP for seeding) ───────────────────
def create_user(phone, name, account_type):
    user = db.query(User).filter(User.phone == phone).first()
    if user:
        return user
    user = User(
        phone=phone, name=name, account_type=account_type,
        is_verified=True, terms_accepted_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

# ── Advertisers ──────────────────────────────────────────────────────────────
advertisers = [
    create_user("01011111111", "أحمد محمود الوسيط",   "broker"),
    create_user("01022222222", "فاطمة علي العقارية",   "owner"),
    create_user("01033333333", "محمد حسن للإيجارات",   "broker"),
    create_user("01044444444", "نورا إبراهيم",         "owner"),
    create_user("01055555555", "كريم عبد الله وسيط", "broker"),
]

# ── Listings data ─────────────────────────────────────────────────────────────
LISTINGS = [
    {
        "title":         "غرفة مفردة مميزة بالقرب من جامعة القاهرة",
        "governorate":   "الجيزة",
        "city":          "الدقي",
        "neighborhood":  "بجوار جامعة القاهرة",
        "address":       "12 شارع النيل، الدقي",
        "gender":        "male",
        "available_beds": 3,
        "price_per_person": 2500,
        "room_type":     "single",
        "description":   "غرفة مفردة مجهزة بالكامل، قريبة من البوابة الرئيسية لجامعة القاهرة. تشمل الإنترنت، التكييف، والأمن ٢٤ ساعة.",
        "amenities":     ["wifi", "ac", "security", "water", "elevator"],
        "room_configurations": [
            {"room_type": "single", "price_per_person": 2500, "commission": 1250}
        ],
        "advertiser_idx": 0,
    },
    {
        "title":         "شقة طلابية للبنات – منطقة المهندسين",
        "governorate":   "الجيزة",
        "city":          "الجيزة",
        "neighborhood":  "المهندسين",
        "address":       "45 شارع جامعة الدول، المهندسين",
        "gender":        "female",
        "available_beds": 4,
        "price_per_person": 2200,
        "room_type":     "double",
        "description":   "شقة هادئة ومؤمّنة مخصصة للطالبات، بإشراف سيدة متخصصة. تشمل الكهرباء والمياه في السعر.",
        "amenities":     ["wifi", "ac", "washing_machine", "security", "water", "electricity"],
        "room_configurations": [
            {"room_type": "double", "price_per_person": 2200, "commission": 1100},
            {"room_type": "triple", "price_per_person": 1700, "commission": 850},
        ],
        "advertiser_idx": 1,
    },
    {
        "title":         "سرير في غرفة مشتركة – وسط البلد",
        "governorate":   "القاهرة",
        "city":          "القاهرة",
        "neighborhood":  "وسط البلد",
        "address":       "8 شارع طلعت حرب، وسط البلد",
        "gender":        "male",
        "available_beds": 6,
        "price_per_person": 1200,
        "room_type":     "shared",
        "description":   "غرفة مشتركة اقتصادية في قلب القاهرة. قريبة من المترو والخدمات والمطاعم.",
        "amenities":     ["wifi", "security"],
        "room_configurations": [
            {"room_type": "shared", "price_per_person": 1200, "commission": 600},
        ],
        "advertiser_idx": 2,
    },
    {
        "title":         "غرفة للطالبات بإشراف كامل – مدينة نصر",
        "governorate":   "القاهرة",
        "city":          "القاهرة",
        "neighborhood":  "مدينة نصر",
        "address":       "20 شارع عباس العقاد، مدينة نصر",
        "gender":        "female",
        "available_beds": 2,
        "price_per_person": 3000,
        "room_type":     "single",
        "description":   "غرفة مفردة فاخرة بإشراف سيدة متخصصة. قريبة من جامعة 6 أكتوبر فرع الأول. تتوفر حافلة مشتركة.",
        "amenities":     ["wifi", "ac", "security", "washing_machine", "water", "electricity", "elevator"],
        "room_configurations": [
            {"room_type": "single", "price_per_person": 3000, "commission": 1500},
            {"room_type": "double", "price_per_person": 2300, "commission": 1150},
        ],
        "advertiser_idx": 3,
    },
    {
        "title":         "استوديو مجهز للطلاب – الزمالك",
        "governorate":   "القاهرة",
        "city":          "القاهرة",
        "neighborhood":  "الزمالك",
        "address":       "15 شارع إبراهيم باشا، الزمالك",
        "gender":        "male",
        "available_beds": 1,
        "price_per_person": 4500,
        "room_type":     "studio",
        "description":   "استوديو راقي بإطلالة على النيل، مناسب للطالب الباحث عن الخصوصية الكاملة. مفروش بأثاث حديث.",
        "amenities":     ["wifi", "ac", "security", "elevator", "water", "electricity"],
        "room_configurations": [
            {"room_type": "studio", "price_per_person": 4500, "commission": 2000},
        ],
        "advertiser_idx": 4,
    },
    {
        "title":         "شقة مشتركة اقتصادية – المنصورة",
        "governorate":   "الدقهلية",
        "city":          "المنصورة",
        "neighborhood":  "بجوار جامعة المنصورة",
        "address":       "3 شارع الجمهورية، المنصورة",
        "gender":        "male",
        "available_beds": 5,
        "price_per_person": 900,
        "room_type":     "shared",
        "description":   "شقة اقتصادية قريبة من حرم جامعة المنصورة. مناسبة لطلاب كلية الطب والهندسة.",
        "amenities":     ["wifi", "ac", "security"],
        "room_configurations": [
            {"room_type": "shared", "price_per_person": 900,  "commission": 450},
            {"room_type": "double", "price_per_person": 1300, "commission": 650},
        ],
        "advertiser_idx": 0,
    },
    {
        "title":         "سكن بنات راقي – الإسكندرية",
        "governorate":   "الإسكندرية",
        "city":          "الإسكندرية",
        "neighborhood":  "سيدي جابر",
        "address":       "7 شارع خالد ابن الوليد، سيدي جابر",
        "gender":        "female",
        "available_beds": 3,
        "price_per_person": 2800,
        "room_type":     "double",
        "description":   "سكن راقي للطالبات قريب من جامعة الإسكندرية والقطار. يشمل: كهرباء، مياه، إنترنت.",
        "amenities":     ["wifi", "ac", "security", "water", "electricity", "washing_machine"],
        "room_configurations": [
            {"room_type": "double", "price_per_person": 2800, "commission": 1400},
            {"room_type": "triple", "price_per_person": 2000, "commission": 1000},
        ],
        "advertiser_idx": 1,
    },
    {
        "title":         "غرفة بأثاث كامل – أسيوط",
        "governorate":   "أسيوط",
        "city":          "أسيوط",
        "neighborhood":  "بجوار جامعة أسيوط",
        "address":       "14 شارع الجامعة، أسيوط",
        "gender":        "male",
        "available_beds": 4,
        "price_per_person": 800,
        "room_type":     "double",
        "description":   "غرفة مزدوجة مؤثثة بالكامل قرب جامعة أسيوط. سعر اقتصادي يشمل جميع المصاريف.",
        "amenities":     ["wifi", "security", "water"],
        "room_configurations": [
            {"room_type": "double", "price_per_person": 800, "commission": 400},
            {"room_type": "triple", "price_per_person": 650, "commission": 325},
        ],
        "advertiser_idx": 2,
    },
    {
        "title":         "شقة للطالبات – الإسماعيلية قرب جامعة قناة السويس",
        "governorate":   "الإسماعيلية",
        "city":          "الإسماعيلية",
        "neighborhood":  "بجوار جامعة قناة السويس",
        "address":       "9 شارع الحرية، الإسماعيلية",
        "gender":        "female",
        "available_beds": 2,
        "price_per_person": 1800,
        "room_type":     "single",
        "description":   "شقة ممتازة للطالبات قريبة من جامعة قناة السويس. بيئة هادئة وآمنة. واي فاي سريع وتكييف.",
        "amenities":     ["wifi", "ac", "security", "elevator"],
        "room_configurations": [
            {"room_type": "single", "price_per_person": 1800, "commission": 900},
            {"room_type": "double", "price_per_person": 1400, "commission": 700},
        ],
        "advertiser_idx": 3,
    },
    {
        "title":         "غرفة بمستوى فندقي – الشيخ زايد",
        "governorate":   "الجيزة",
        "city":          "الشيخ زايد",
        "neighborhood":  "الحي الأول",
        "address":       "22 شارع مصطفى محمود، الشيخ زايد",
        "gender":        "male",
        "available_beds": 2,
        "price_per_person": 3500,
        "room_type":     "single",
        "description":   "غرفة فردية بمستوى فندقي قريبة من الجامعة الأمريكية فرع الشيخ زايد. مؤمنة بكاميرات مراقبة.",
        "amenities":     ["wifi", "ac", "security", "elevator", "water", "electricity", "washing_machine"],
        "room_configurations": [
            {"room_type": "single", "price_per_person": 3500, "commission": 1750},
        ],
        "advertiser_idx": 4,
    },
]

# ── Insert into DB ────────────────────────────────────────────────────────────
created = 0
for data in LISTINGS:
    advertiser = advertisers[data["advertiser_idx"]]
    listing = Listing(
        title=data["title"],
        governorate=data["governorate"],
        city=data["city"],
        neighborhood=data["neighborhood"],
        address=data["address"],
        gender=data["gender"],
        available_beds=data["available_beds"],
        price_per_person=data["price_per_person"],
        room_type=data["room_type"],
        amenities=json.dumps(data["amenities"], ensure_ascii=False),
        room_configurations=json.dumps(data["room_configurations"], ensure_ascii=False),
        status="active",
        tier="regular",
        advertiser_id=advertiser.id,
        created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
    )
    db.add(listing)
    created += 1

db.commit()
db.close()

print(f"\n✅ Seeded {len(advertisers)} advertisers and {created} listings into sakan.db\n")
for i, d in enumerate(LISTINGS, 1):
    print(f"  {i:2}. {d['governorate']:12} | {d['gender']:6} | {d['price_per_person']:,} ج.م/شهر | {d['title'][:40]}")
print()
