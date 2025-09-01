// Simple test script to verify streaming functionality
async function testStreaming() {
  try {
    console.log('Testing streaming endpoint...');
    
    const response = await fetch('http://localhost:5000/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'hi' }),
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      console.error('Request failed:', response.status, response.statusText);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      console.error('No reader available');
      return;
    }

    const decoder = new TextDecoder();
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('Stream completed');
        break;
      }

      chunkCount++;
      const chunk = decoder.decode(value);
      console.log(`Chunk ${chunkCount}:`, chunk);

      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            console.log('Parsed data:', data);
          } catch (e) {
            console.log('Failed to parse:', line);
          }
        }
      }
    }

    console.log(`Total chunks received: ${chunkCount}`);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test the regular endpoint too
async function testRegular() {
  try {
    console.log('Testing regular endpoint...');
    
    const response = await fetch('http://localhost:5000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'hi' }),
    });

    const data = await response.json();
    console.log('Regular response:', data);
  } catch (error) {
    console.error('Regular test failed:', error);
  }
}

// Run tests
console.log('Starting streaming tests...');
testStreaming().then(() => {
  console.log('\nTesting regular endpoint...');
  return testRegular();
}).then(() => {
  console.log('Tests completed');
});