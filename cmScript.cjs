const fs = require('fs');
const prompts = require('prompts');

const startTool = async () => {
  const fetch = (await import('node-fetch')).default;

  // Get the user inputs
  const response = await prompts({
    type: 'text',
    name: 'topic',
    message: 'What topic would you like some help with? (e.g., specific array methods, closures, async/await)'
  });
  const topic = response.topic;

  const response2 = await prompts({
    type: 'number',
    name: 'quantity',
    message: 'How many questions should we start with? (between 1 and 3):',
    validate: value => (value >= 1 && value <= 3) ? true : 'Please enter a number between 1 and 3'
  });
  const numQuantity = response2.quantity;
  const numToStr = {
    1: "one",
    2: "two",
    3: "three"
  };
  const quantity = numToStr[numQuantity];

  const response3 = await prompts({
    type: "select",
    name: "difficulty",
    message: "What level of difficulty would you like?:",
    choices: [
      { title: "Beginner questions", value: "beginner" },
      { title: "Intermediate questions", value: "intermediate" },
      { title: "Advanced questions", value: "advanced" }
    ],
    initial: 0
  });
  const difficulty = response3.difficulty;

  // Get questions and answers from LLM
  const { updatedData }  = await getLLMContent(topic, quantity, difficulty);

  // Create the question and answer files
  createFiles(topic, updatedData);
};


const getLLMContent = async (topic, quantity, difficulty) => {
  const fetch = (await import('node-fetch')).default;

  // Fetching data from the web worker
  const apiResponse = await fetch('https://codemastery.aripine93.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: topic,
      quantity: quantity,
      difficulty: difficulty
    })
  });

  const data = await apiResponse.json();
  const updatedData = `let info = ${data}`;

  return { updatedData };
};

// Function to create the files
const createFiles = (topic, updatedData) => {
  const questionHintFile = `${topic}_questions_hints.js`;
 
  fs.writeFileSync(questionHintFile, updatedData, 'utf8');
  console.log(`File created: ${questionHintFile}`);
};


startTool();
