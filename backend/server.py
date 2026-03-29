from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionData(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvoiceItem(BaseModel):
    item_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_name: str
    batch_no: Optional[str] = None
    expiry_date: Optional[str] = None  # Format: MM/YY or MM/YYYY
    expiry_datetime: Optional[datetime] = None  # Parsed datetime for queries
    quantity: Optional[float] = None
    price: Optional[float] = None
    mrp: Optional[float] = None
    amount: Optional[float] = None

class Invoice(BaseModel):
    invoice_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    shop_name: str
    invoice_date: Optional[str] = None  # Original date string from invoice
    invoice_datetime: Optional[datetime] = None  # Parsed datetime
    total_amount: Optional[float] = None
    image_base64: Optional[str] = None  # Store the invoice image
    items: List[InvoiceItem] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InvoiceCreate(BaseModel):
    image_base64: str

class ExpiryAlert(BaseModel):
    item_id: str
    invoice_id: str
    product_name: str
    batch_no: Optional[str]
    expiry_date: str
    expiry_datetime: datetime
    shop_name: str
    quantity: Optional[float]
    days_until_expiry: int

class ShopReport(BaseModel):
    shop_name: str
    total_amount: float
    invoice_count: int
    invoices: List[dict]

# ==================== AUTH HELPERS ====================

async def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie or Authorization header"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        return session_token
    
    # Try Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    
    return None

async def get_current_user(request: Request) -> User:
    """Get current authenticated user"""
    session_token = await get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Find user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id from OAuth callback for session token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Exchange session_id with Emergent Auth
    async with httpx.AsyncClient() as client_http:
        try:
            auth_response = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            user_data = auth_response.json()
        except Exception as e:
            logger.error(f"Auth error: {e}")
            raise HTTPException(status_code=500, detail="Authentication failed")
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user data
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": user_data["name"],
                "picture": user_data.get("picture")
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
    
    # Create session
    session_token = user_data.get("session_token", f"session_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    # Get full user data
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {"user": user_doc, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user info"""
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = await get_session_token(request)
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"message": "Logged out"}

# ==================== OCR HELPER ====================

def parse_expiry_date(expiry_str: str) -> Optional[datetime]:
    """Parse expiry date string to datetime"""
    if not expiry_str:
        return None
    
    # Clean the string
    expiry_str = expiry_str.strip().upper()
    
    # Common formats: MM/YY, MM/YYYY, MM-YY, MM-YYYY
    formats = [
        "%m/%y", "%m/%Y", "%m-%y", "%m-%Y",
        "%b/%y", "%b/%Y", "%b-%y", "%b-%Y",
        "%B/%y", "%B/%Y", "%B-%y", "%B-%Y",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(expiry_str, fmt)
            # Set to end of month for expiry
            if dt.month == 12:
                dt = dt.replace(year=dt.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                dt = dt.replace(month=dt.month + 1, day=1) - timedelta(days=1)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    
    return None

def parse_invoice_date(date_str: str) -> Optional[datetime]:
    """Parse invoice date string to datetime"""
    if not date_str:
        return None
    
    # Clean the string
    date_str = date_str.strip()
    
    # Common formats
    formats = [
        "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
        "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
        "%Y-%m-%d", "%Y/%m/%d",
        "%d %b %Y", "%d %B %Y",
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    
    return None

async def extract_invoice_data(image_base64: str) -> dict:
    """Extract invoice data using Gemini Vision"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    
    # Create chat instance with Gemini
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"invoice_{uuid.uuid4().hex[:8]}",
        system_message="""You are an expert invoice data extractor. Extract data from pharmaceutical/medical invoices accurately.
        
Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:
{
    "shop_name": "Name of the medical shop/agency",
    "invoice_date": "Date in DD/MM/YYYY format",
    "total_amount": numeric value or null,
    "items": [
        {
            "product_name": "Medicine/product name",
            "batch_no": "Batch number",
            "expiry_date": "Expiry date in MM/YY format",
            "quantity": numeric value,
            "price": rate/price per unit,
            "mrp": MRP value,
            "amount": total amount for this item
        }
    ]
}

Important:
- Extract ALL items from the invoice
- Use null for missing values
- Expiry dates are usually in EXP column, format MM/YY
- Shop name is usually at the top of the invoice
- Look for columns like MFR, HSN Code, Product Name, PACK, BATCH, EXP, M.R.P, QTY, RATE, AMOUNT"""
    ).with_model("gemini", "gemini-2.5-flash")
    
    # Clean base64 if it has data URL prefix
    if "," in image_base64:
        image_base64 = image_base64.split(",")[1]
    
    # Create image content
    image_content = ImageContent(image_base64=image_base64)
    
    # Send message with image
    user_message = UserMessage(
        text="Extract all data from this pharmaceutical invoice. Return ONLY the JSON, no other text.",
        image_contents=[image_content]
    )
    
    response = await chat.send_message(user_message)
    
    # Parse JSON from response
    import json
    
    # Clean response - remove markdown code blocks if present
    response_text = response.strip()
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])
    
    try:
        data = json.loads(response_text)
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse OCR response: {e}")
        logger.error(f"Response: {response_text}")
        raise HTTPException(status_code=500, detail="Failed to parse invoice data")

# ==================== INVOICE ENDPOINTS ====================

@api_router.post("/invoices/scan")
async def scan_invoice(invoice_data: InvoiceCreate, user: User = Depends(get_current_user)):
    """Scan an invoice image and extract data"""
    try:
        # Extract data using Gemini Vision
        extracted = await extract_invoice_data(invoice_data.image_base64)
        
        # Parse dates
        invoice_datetime = parse_invoice_date(extracted.get("invoice_date"))
        
        # Process items
        items = []
        for item_data in extracted.get("items", []):
            expiry_str = item_data.get("expiry_date")
            expiry_datetime = parse_expiry_date(expiry_str)
            
            item = InvoiceItem(
                product_name=item_data.get("product_name", "Unknown"),
                batch_no=item_data.get("batch_no"),
                expiry_date=expiry_str,
                expiry_datetime=expiry_datetime,
                quantity=item_data.get("quantity"),
                price=item_data.get("price"),
                mrp=item_data.get("mrp"),
                amount=item_data.get("amount")
            )
            items.append(item)
        
        # Create invoice
        invoice = Invoice(
            user_id=user.user_id,
            shop_name=extracted.get("shop_name", "Unknown Shop"),
            invoice_date=extracted.get("invoice_date"),
            invoice_datetime=invoice_datetime,
            total_amount=extracted.get("total_amount"),
            image_base64=invoice_data.image_base64,
            items=items
        )
        
        # Save to database
        invoice_dict = invoice.model_dump()
        await db.invoices.insert_one(invoice_dict)
        
        # Remove image from response to reduce payload
        response_dict = invoice.model_dump()
        response_dict.pop("image_base64", None)
        
        return response_dict
        
    except Exception as e:
        logger.error(f"Scan invoice error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/invoices")
async def get_invoices(user: User = Depends(get_current_user)):
    """Get all invoices for current user"""
    invoices = await db.invoices.find(
        {"user_id": user.user_id},
        {"_id": 0, "image_base64": 0}  # Exclude image to reduce payload
    ).sort("created_at", -1).to_list(1000)
    
    return invoices

@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user: User = Depends(get_current_user)):
    """Get a specific invoice"""
    invoice = await db.invoices.find_one(
        {"invoice_id": invoice_id, "user_id": user.user_id},
        {"_id": 0}
    )
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return invoice

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: User = Depends(get_current_user)):
    """Delete an invoice"""
    result = await db.invoices.delete_one(
        {"invoice_id": invoice_id, "user_id": user.user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    return {"message": "Invoice deleted"}

# ==================== EXPIRY ALERTS ENDPOINTS ====================

@api_router.get("/expiry-alerts")
async def get_expiry_alerts(user: User = Depends(get_current_user)):
    """Get items expiring this month and next month"""
    now = datetime.now(timezone.utc)
    
    # Calculate end of next month
    if now.month == 12:
        next_month_end = now.replace(year=now.year + 1, month=2, day=1) - timedelta(days=1)
    elif now.month == 11:
        next_month_end = now.replace(year=now.year + 1, month=1, day=1) - timedelta(days=1)
    else:
        next_month_end = now.replace(month=now.month + 2, day=1) - timedelta(days=1)
    
    # Get all invoices for user
    invoices = await db.invoices.find(
        {"user_id": user.user_id},
        {"_id": 0, "image_base64": 0}
    ).to_list(1000)
    
    this_month_alerts = []
    next_month_alerts = []
    expired_alerts = []
    
    for invoice in invoices:
        for item in invoice.get("items", []):
            expiry_dt = item.get("expiry_datetime")
            if not expiry_dt:
                continue
            
            if isinstance(expiry_dt, str):
                try:
                    expiry_dt = datetime.fromisoformat(expiry_dt.replace('Z', '+00:00'))
                except:
                    continue
            
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
            
            days_until = (expiry_dt - now).days
            
            alert = {
                "item_id": item.get("item_id"),
                "invoice_id": invoice.get("invoice_id"),
                "product_name": item.get("product_name"),
                "batch_no": item.get("batch_no"),
                "expiry_date": item.get("expiry_date"),
                "expiry_datetime": expiry_dt.isoformat(),
                "shop_name": invoice.get("shop_name"),
                "quantity": item.get("quantity"),
                "days_until_expiry": days_until
            }
            
            if days_until < 0:
                expired_alerts.append(alert)
            elif expiry_dt.month == now.month and expiry_dt.year == now.year:
                this_month_alerts.append(alert)
            elif (expiry_dt.month == (now.month % 12) + 1 and 
                  (expiry_dt.year == now.year or (now.month == 12 and expiry_dt.year == now.year + 1))):
                next_month_alerts.append(alert)
    
    # Sort by days until expiry
    this_month_alerts.sort(key=lambda x: x["days_until_expiry"])
    next_month_alerts.sort(key=lambda x: x["days_until_expiry"])
    expired_alerts.sort(key=lambda x: x["days_until_expiry"], reverse=True)
    
    return {
        "expired": expired_alerts,
        "this_month": this_month_alerts,
        "next_month": next_month_alerts
    }

# ==================== REPORTS ENDPOINTS ====================

@api_router.get("/reports/monthly")
async def get_monthly_report(
    year: int,
    month: int,
    user: User = Depends(get_current_user)
):
    """Get monthly billing report by shop"""
    # Calculate date range
    start_date = datetime(year, month, 1, tzinfo=timezone.utc)
    if month == 12:
        end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    
    # Get invoices for the month
    invoices = await db.invoices.find(
        {
            "user_id": user.user_id,
            "invoice_datetime": {"$gte": start_date, "$lt": end_date}
        },
        {"_id": 0, "image_base64": 0}
    ).to_list(1000)
    
    # Group by shop
    shop_reports = {}
    for invoice in invoices:
        shop_name = invoice.get("shop_name", "Unknown")
        if shop_name not in shop_reports:
            shop_reports[shop_name] = {
                "shop_name": shop_name,
                "total_amount": 0,
                "invoice_count": 0,
                "invoices": []
            }
        
        amount = invoice.get("total_amount") or 0
        shop_reports[shop_name]["total_amount"] += amount
        shop_reports[shop_name]["invoice_count"] += 1
        shop_reports[shop_name]["invoices"].append({
            "invoice_id": invoice.get("invoice_id"),
            "invoice_date": invoice.get("invoice_date"),
            "total_amount": amount,
            "item_count": len(invoice.get("items", []))
        })
    
    # Sort invoices within each shop by date
    for shop in shop_reports.values():
        shop["invoices"].sort(key=lambda x: x.get("invoice_date", ""), reverse=True)
    
    return {
        "year": year,
        "month": month,
        "shops": list(shop_reports.values()),
        "total_amount": sum(s["total_amount"] for s in shop_reports.values()),
        "total_invoices": len(invoices)
    }

@api_router.get("/reports/summary")
async def get_summary(user: User = Depends(get_current_user)):
    """Get overall summary for dashboard"""
    # Count invoices
    invoice_count = await db.invoices.count_documents({"user_id": user.user_id})
    
    # Get all invoices for calculations
    invoices = await db.invoices.find(
        {"user_id": user.user_id},
        {"_id": 0, "image_base64": 0}
    ).to_list(1000)
    
    # Calculate totals
    total_amount = sum(inv.get("total_amount") or 0 for inv in invoices)
    total_items = sum(len(inv.get("items", [])) for inv in invoices)
    
    # Count unique shops
    shops = set(inv.get("shop_name") for inv in invoices if inv.get("shop_name"))
    
    # Get expiry alerts count
    now = datetime.now(timezone.utc)
    expiring_soon = 0
    expired = 0
    
    for invoice in invoices:
        for item in invoice.get("items", []):
            expiry_dt = item.get("expiry_datetime")
            if not expiry_dt:
                continue
            
            if isinstance(expiry_dt, str):
                try:
                    expiry_dt = datetime.fromisoformat(expiry_dt.replace('Z', '+00:00'))
                except:
                    continue
            
            if expiry_dt.tzinfo is None:
                expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
            
            days_until = (expiry_dt - now).days
            
            if days_until < 0:
                expired += 1
            elif days_until <= 60:  # Within 2 months
                expiring_soon += 1
    
    return {
        "invoice_count": invoice_count,
        "total_amount": total_amount,
        "total_items": total_items,
        "shop_count": len(shops),
        "expiring_soon": expiring_soon,
        "expired": expired
    }

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "Invoice Scanner API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
