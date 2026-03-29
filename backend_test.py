#!/usr/bin/env python3
"""
Backend API Testing for Invoice Scanner App
Tests health check, auth, and protected endpoints
"""

import requests
import json
import subprocess
import time
from datetime import datetime

# Base URL from frontend/.env
BASE_URL = "https://invoice-snap-12.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

class InvoiceScannerTester:
    def __init__(self):
        self.session_token = None
        self.user_id = None
        self.test_results = []
        
    def log_test(self, test_name, success, details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "success": success,
            "details": details
        })
        print(f"{status}: {test_name}")
        if details:
            print(f"   Details: {details}")
        print()
    
    def test_health_endpoints(self):
        """Test health check endpoints"""
        print("=== Testing Health Check Endpoints ===")
        
        # Test GET /api/
        try:
            response = requests.get(f"{API_BASE}/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "status" in data:
                    self.log_test("Health Check - Root Endpoint", True, f"Response: {data}")
                else:
                    self.log_test("Health Check - Root Endpoint", False, f"Unexpected response format: {data}")
            else:
                self.log_test("Health Check - Root Endpoint", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Health Check - Root Endpoint", False, f"Error: {str(e)}")
        
        # Test GET /api/health
        try:
            response = requests.get(f"{API_BASE}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if "status" in data:
                    self.log_test("Health Check - Health Endpoint", True, f"Response: {data}")
                else:
                    self.log_test("Health Check - Health Endpoint", False, f"Unexpected response format: {data}")
            else:
                self.log_test("Health Check - Health Endpoint", False, f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Health Check - Health Endpoint", False, f"Error: {str(e)}")
    
    def create_test_user_session(self):
        """Create test user and session in MongoDB"""
        print("=== Creating Test User and Session ===")
        
        try:
            # Generate unique identifiers
            timestamp = int(time.time())
            user_id = f"test-user-{timestamp}"
            session_token = f"test_session_{timestamp}"
            email = f"test.user.{timestamp}@example.com"
            
            # MongoDB command to create user and session
            mongo_command = f"""
mongosh --eval "
use('test_database');
var userId = '{user_id}';
var sessionToken = '{session_token}';
var email = '{email}';
db.users.insertOne({{
  user_id: userId,
  email: email,
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
}});
db.user_sessions.insertOne({{
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
print('Email: ' + email);
"
"""
            
            # Execute MongoDB command
            result = subprocess.run(mongo_command, shell=True, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                # Extract session token and user ID from output
                output_lines = result.stdout.strip().split('\n')
                for line in output_lines:
                    if 'Session token:' in line:
                        self.session_token = line.split('Session token: ')[1].strip()
                    elif 'User ID:' in line:
                        self.user_id = line.split('User ID: ')[1].strip()
                
                if self.session_token and self.user_id:
                    self.log_test("Create Test User and Session", True, 
                                f"User ID: {self.user_id}, Session Token: {self.session_token[:20]}...")
                else:
                    self.log_test("Create Test User and Session", False, 
                                f"Failed to extract session token or user ID from output: {result.stdout}")
            else:
                self.log_test("Create Test User and Session", False, 
                            f"MongoDB command failed: {result.stderr}")
                
        except Exception as e:
            self.log_test("Create Test User and Session", False, f"Error: {str(e)}")
    
    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("=== Testing Authentication Endpoints ===")
        
        if not self.session_token:
            self.log_test("Auth Test - No Session Token", False, "Cannot test auth without session token")
            return
        
        # Test GET /api/auth/me
        try:
            headers = {"Authorization": f"Bearer {self.session_token}"}
            response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if "user_id" in data and "email" in data and "name" in data:
                    self.log_test("Auth - Get Current User", True, f"User data: {data}")
                else:
                    self.log_test("Auth - Get Current User", False, f"Unexpected response format: {data}")
            else:
                self.log_test("Auth - Get Current User", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Auth - Get Current User", False, f"Error: {str(e)}")
    
    def test_protected_endpoints(self):
        """Test protected endpoints that require authentication"""
        print("=== Testing Protected Endpoints ===")
        
        if not self.session_token:
            self.log_test("Protected Endpoints - No Session Token", False, "Cannot test protected endpoints without session token")
            return
        
        headers = {"Authorization": f"Bearer {self.session_token}"}
        
        # Test GET /api/invoices
        try:
            response = requests.get(f"{API_BASE}/invoices", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_test("Protected - Get Invoices", True, f"Returned {len(data)} invoices (expected empty list)")
                else:
                    self.log_test("Protected - Get Invoices", False, f"Expected list, got: {type(data)}")
            else:
                self.log_test("Protected - Get Invoices", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Protected - Get Invoices", False, f"Error: {str(e)}")
        
        # Test GET /api/expiry-alerts
        try:
            response = requests.get(f"{API_BASE}/expiry-alerts", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["expired", "this_month", "next_month"]
                if all(key in data for key in expected_keys):
                    all_empty = all(isinstance(data[key], list) and len(data[key]) == 0 for key in expected_keys)
                    if all_empty:
                        self.log_test("Protected - Get Expiry Alerts", True, "Returned empty alert lists as expected")
                    else:
                        self.log_test("Protected - Get Expiry Alerts", True, f"Returned alert data: {data}")
                else:
                    self.log_test("Protected - Get Expiry Alerts", False, f"Missing expected keys. Got: {data}")
            else:
                self.log_test("Protected - Get Expiry Alerts", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Protected - Get Expiry Alerts", False, f"Error: {str(e)}")
        
        # Test GET /api/reports/monthly
        try:
            response = requests.get(f"{API_BASE}/reports/monthly?year=2025&month=7", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["year", "month", "shops", "total_amount", "total_invoices"]
                if all(key in data for key in expected_keys):
                    if data["year"] == 2025 and data["month"] == 7:
                        self.log_test("Protected - Get Monthly Report", True, f"Monthly report data: {data}")
                    else:
                        self.log_test("Protected - Get Monthly Report", False, f"Incorrect year/month in response: {data}")
                else:
                    self.log_test("Protected - Get Monthly Report", False, f"Missing expected keys. Got: {data}")
            else:
                self.log_test("Protected - Get Monthly Report", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Protected - Get Monthly Report", False, f"Error: {str(e)}")
        
        # Test GET /api/reports/summary
        try:
            response = requests.get(f"{API_BASE}/reports/summary", headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                expected_keys = ["invoice_count", "total_amount", "total_items", "shop_count", "expiring_soon", "expired"]
                if all(key in data for key in expected_keys):
                    # For new user, all counts should be 0
                    all_zero = all(data[key] == 0 for key in expected_keys)
                    if all_zero:
                        self.log_test("Protected - Get Summary Report", True, "All summary counts are 0 as expected for new user")
                    else:
                        self.log_test("Protected - Get Summary Report", True, f"Summary data: {data}")
                else:
                    self.log_test("Protected - Get Summary Report", False, f"Missing expected keys. Got: {data}")
            else:
                self.log_test("Protected - Get Summary Report", False, 
                            f"Status: {response.status_code}, Response: {response.text}")
        except Exception as e:
            self.log_test("Protected - Get Summary Report", False, f"Error: {str(e)}")
    
    def test_unauthorized_access(self):
        """Test that protected endpoints reject unauthorized requests"""
        print("=== Testing Unauthorized Access ===")
        
        # Test without auth header
        try:
            response = requests.get(f"{API_BASE}/invoices", timeout=10)
            if response.status_code == 401:
                self.log_test("Unauthorized - No Auth Header", True, "Correctly rejected unauthorized request")
            else:
                self.log_test("Unauthorized - No Auth Header", False, 
                            f"Expected 401, got {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Unauthorized - No Auth Header", False, f"Error: {str(e)}")
        
        # Test with invalid token
        try:
            headers = {"Authorization": "Bearer invalid_token_12345"}
            response = requests.get(f"{API_BASE}/invoices", headers=headers, timeout=10)
            if response.status_code == 401:
                self.log_test("Unauthorized - Invalid Token", True, "Correctly rejected invalid token")
            else:
                self.log_test("Unauthorized - Invalid Token", False, 
                            f"Expected 401, got {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Unauthorized - Invalid Token", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print(f"Starting Invoice Scanner Backend API Tests")
        print(f"Base URL: {BASE_URL}")
        print(f"API Base: {API_BASE}")
        print(f"Test started at: {datetime.now()}")
        print("=" * 60)
        
        # Run tests in order
        self.test_health_endpoints()
        self.create_test_user_session()
        self.test_auth_endpoints()
        self.test_protected_endpoints()
        self.test_unauthorized_access()
        
        # Summary
        print("=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print()
        
        if failed_tests > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"❌ {result['test']}: {result['details']}")
            print()
        
        print("ALL TEST RESULTS:")
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
        
        return passed_tests, failed_tests

if __name__ == "__main__":
    tester = InvoiceScannerTester()
    passed, failed = tester.run_all_tests()
    
    if failed > 0:
        exit(1)
    else:
        print("\n🎉 All tests passed!")
        exit(0)