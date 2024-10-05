const fs = require('fs');
const prompts = require('prompts');

const startTool = async() => {
  const fetch = (await import('node-fetch')).default;
  // Prompt the user for a topic
  const response = await prompts({
    type: 'text',
    name: 'topic',
    message: 'What topic would you like to generate questions for? (e.g., array methods, closures)'
  });

  const topic = response.topic;

  // Get questions and answers from LLM (mock for now)
  const { questions, answers } = await getLLMContent(topic);

  // Create the question and answer files
  createFiles(topic, questions, answers);
}

// Placeholder function for calling LLM API
const getLLMContent = async(fetch, topic) => {
  // Replace with actual LLM API call later
  // const apiResponse = await fetch('https://example-llm-api.com/generate', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ topic })
  // });

  // For now, mock the response
  return {
    questions: `// Questions for ${topic}\nconsole.log("Question 1 for ${topic}");`,
    answers: `// Answers for ${topic}\nconsole.log("Answer 1 for ${topic}");`
  };
}

// Function to create the files
const createFiles = (topic, questions, answers) => {
  const questionFile = `${topic}questions.js`;
  const answerFile = `${topic}answers.js`;

  // Write the questions and answers to their respective files
  fs.writeFileSync(questionFile, questions, 'utf8');
  fs.writeFileSync(answerFile, answers, 'utf8');

  console.log(`Files created: ${questionFile}, ${answerFile}`);
}

// Start the tool
startTool();
