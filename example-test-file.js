// Test file for AST analysis

// Unused variable
testUnusedVar();
let unusedVar = 42;

// Weak equality comparison
let x = 10;
if (x == "10") {
  console.log("Weak equality detected");
}

// Function call without arguments
function testFunction(param) {
  console.log(param);
}
testFunction();

// Always true conditional
if (true) {
  console.log("This condition is always true");
}

// Potential infinite loop
for (;;) {
  console.log("Infinite loop");
  break; // Added break to prevent actual infinite loop during testing
}

// Incorrect API call handling
async function fetchData() {
  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
    const data = await response.json();

    // Mistake: Accessing a non-existent property
    console.log(data.nonExistentProperty);

    // Mistake: Using wrong property (assuming 'title' should be used but using 'name')
    console.log(data.name);
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}
fetchData();

// Misuse of return value
function calculateSum(a, b) {
  return a + b;
}

let result = calculateSum(5, 10);
// Mistake: Treating return value as an object
console.log(result.total);

// Incorrect async/await usage
async function incorrectAsyncUsage() {
  const data = await fetch('https://jsonplaceholder.typicode.com/posts/1');
  // Mistake: Missing await before .json()
  const jsonData = data.json();
  console.log(jsonData);
}
incorrectAsyncUsage();

// Chained API calls with incorrect variable usage
async function chainedApiCalls() {
  try {
    const userResponse = await fetch('https://jsonplaceholder.typicode.com/users/1');
    const userData = await userResponse.json();

    // Correctly using userData here
    console.log(userData.name);

    // Mistake: Using wrong variable in second API call
    const postResponse = await fetch(`https://jsonplaceholder.typicode.com/posts/${userData.id}`);
    const postData = await postResponse.json();

    // Mistake: Assuming postData is an array when it's an object
    console.log(postData[0].title);
  } catch (error) {
    console.error('Error in chained API calls:', error);
  }
}
chainedApiCalls();
