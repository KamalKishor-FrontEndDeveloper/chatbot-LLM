// Test async generator functionality
async function* simpleGenerator() {
  yield 'Hello';
  yield ' ';
  yield 'World';
}

async function testGenerator() {
  console.log('Testing async generator...');
  
  const gen = simpleGenerator();
  console.log('Generator created:', typeof gen);
  console.log('Has Symbol.asyncIterator:', typeof gen[Symbol.asyncIterator] === 'function');
  
  for await (const chunk of gen) {
    console.log('Chunk:', chunk);
  }
  
  console.log('Generator test completed');
}

testGenerator().catch(console.error);