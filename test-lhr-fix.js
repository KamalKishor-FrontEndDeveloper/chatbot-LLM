// Test script to verify LHR query matching
const { HealthcareApiService } = require('./server/services/healthcare-api.ts');

// Mock data for testing
const mockTreatments = [
  {
    id: 1,
    t_name: "Laser Hair Reduction",
    name: "Laser Hair Reduction",
    price: "₹5,000",
    doctors: "[1,2,3]",
    parent_id: 0
  },
  {
    id: 2,
    t_name: "Hairfall in Men",
    name: "Hairfall in Men",
    price: "₹1,000",
    doctors: "[1,2]",
    parent_id: 0
  },
  {
    id: 3,
    t_name: "Laser Hair Removal",
    name: "Laser Hair Removal",
    price: "₹6,000",
    doctors: "[1,2,3]",
    parent_id: 0
  }
];

// Test the findSpecificTreatment method
function testLHRMatching() {
  console.log("🧪 Testing LHR query matching...");
  
  const healthcareApi = new HealthcareApiService();
  
  // Test LHR query
  console.log("\n1. Testing 'LHR' query:");
  const lhrResult = healthcareApi.findSpecificTreatment("LHR", mockTreatments);
  console.log("Result:", lhrResult ? lhrResult.t_name : "No match found");
  
  // Test laser hair removal query
  console.log("\n2. Testing 'laser hair removal' query:");
  const laserResult = healthcareApi.findSpecificTreatment("laser hair removal", mockTreatments);
  console.log("Result:", laserResult ? laserResult.t_name : "No match found");
  
  // Test cost of LHR query
  console.log("\n3. Testing 'cost of LHR' query:");
  const costResult = healthcareApi.findSpecificTreatment("cost of LHR", mockTreatments);
  console.log("Result:", costResult ? costResult.t_name : "No match found");
  
  console.log("\n✅ Test completed!");
}

// Run the test
testLHRMatching();
