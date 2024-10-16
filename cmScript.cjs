const fs = require('fs');
const prompts = require('prompts');

const startTool = async () => {
  const fetch = (await import('node-fetch')).default;

  
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
  }
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
  const { questions, answers } = await getLLMContent(topic, quantity, difficulty);

  // Create the question and answer files
  createFiles(topic, questions, answers);
};

const getLLMContent = async (topic, quantity, difficulty) => {
  const fetch = (await import('node-fetch')).default;

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

  
  // Example: [{ question: "What is a closure?", answer: "A closure is ..."}, {...}]
  
  const questionList = data.questions.map((item, index) => `Q${index + 1}: ${item.question}`).join('\n');
  const answerList = data.questions.map((item, index) => `Q${index + 1}: ${item.answer}`).join('\n');

  return {
    questions: `// Questions for ${topic} (${difficulty} level)\n${questionList}`,
    answers: `// Answers for ${topic} (${difficulty} level)\n${answerList}`
  };
};

// Function to create the files
const createFiles = (topic, questions, answers) => {
  const questionFile = `${topic}questions.js`;
  const answerFile = `${topic}answers.js`;

  // Write the questions to the file
  fs.writeFileSync(questionFile, questions, 'utf8');
  console.log(`Files created: ${questionFile}`);

  // Write the answers to the file
  fs.writeFileSync(answerFile, answers, 'utf8');
  console.log(`Files created: ${answerFile}`);
};

startTool();
