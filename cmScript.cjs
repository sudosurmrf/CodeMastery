const fs = require('fs');
const prompts = require('prompts');

const startTool = async () => {
  const fetch = (await import('node-fetch')).default;

  // Prompt the user for a topic, number of questions, and difficulty
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
  const { questions } = await getLLMContent(topic, quantity, difficulty);

  // Create the question file (will create answer file later)
  createFiles(topic, questions);
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

  // Log the response from the API to the console to check the structure, if you're having trouble with the program creating new files, uncomment the below line to help debug. 
  // console.log('response:', JSON.stringify(data, null, 2));

  // Check if the response is in the expected format and contains generated_text
  const objectData = Object.values(data)[0];
  return {
      questions: `// Questions for ${topic} (${difficulty} level)\n${objectData}`
    };
};


// Function to create the files
const createFiles = (topic, questions) => {
  const questionFile = `${topic}questions.js`;

  // Write the questions to the file
  fs.writeFileSync(questionFile, questions, 'utf8');
  console.log(`Files created: ${questionFile}`);
};

// Start the tool
startTool();


