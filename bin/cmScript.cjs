#!/usr/bin/env node

// Your script logic
console.log('Codemastery has started running!');


const fs = require('fs');
const prompts = require('prompts');

// Start the tool and get user inputs
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

  // Get questions and answers from the LLM
  const parsedData = await getLLMContent(topic, quantity, difficulty);

  // Create the question and answer files
  createFiles(topic, parsedData);
};

// Fetches the API content and returns parsed data
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
  
  let data  = await apiResponse.json();
  let parsedData = JSON.parse(data);

  return parsedData
};

// Function to create the files
const createFiles = (topic, parsedData) => {
  const questionHintFile = `${topic}_questions.js`;
  const answerExplanationFile = `${topic}_answers.js`;

  // Extract questions and hints
  const questionHintContent = parsedData.map(item => `/* Question: ${item.question}\nHint: ${item.hint} */`).join('\n\n');

  // Extract answers and explanations
  const answerExplanationContent = parsedData.map(item => `/* Answer: ${item.answer}\nExplanation: ${item.explanation} */`).join('\n\n');

  // Write questions and hints to file
  fs.writeFileSync(questionHintFile, questionHintContent, 'utf8');
  console.log(`File created: ${questionHintFile}`);

  // Write answers and explanations to file
  fs.writeFileSync(answerExplanationFile, answerExplanationContent, 'utf8');
  console.log(`File created: ${answerExplanationFile}`);
};

startTool();
