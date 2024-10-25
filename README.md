# CodeMastery

**CodeMastery** is an interactive tool designed to help students from Fullstack Academy and beyond improve their coding skills. The package allows users to search for specific coding topics and generates personalized practice problems and answers directly in their IDE. 

## Features

- 📚 **Customizable Coding Practice**: Search for coding topics like "array methods" or "closures" and generate tailored questions and answers.
- 💡 **Real-time Problem Solving**: Designed to help users practice coding in a familiar environment with automatically generated files.
- 🔍 **File Analysis (Coming Soon)**: Analyze your existing code to detect methods and patterns, and generate relevant practice questions based on your own projects. This will also generate a file which can be used to graph the data flow within your application!

## Installation

To get started, simply install the package using NPM:
Make sure to have a package.json already setup (npm init -y)
```bash
npm install codemastery
Usage
After installation, you can begin using CodeMastery immediately. Run the following command to start generating coding problems:
Either use:
npm run codemastery

or 

npx codemastery

-------------
Scanning and testing:

To scan recursively in the root, run: 

npm run codemastery:scan

To scan a test file, run:

npm run codemastery:test


After the scan is complete, run npx http-server to open a webpage that will display an interactive graph of your data flow!

Example Workflow
Choose a Topic: Enter a coding topic you would like to practice (e.g., arrays, promises, flexbox).
View Generated Files: CodeMastery will generate two files in your working directory:
<topic-name>questions.js
<topic-name>answers.js
Start Coding: Open the generated files and start solving the questions in your preferred IDE!

Roadmap
✨ Real-time Code Testing: Coming soon, CodeMastery will integrate real-time code testing for JavaScript.
✨ CSS and HTML Practice: Placeholder functionality will be filled with CSS/HTML practice questions and solutions.
✨ File Analysis: Analyze your codebase for patterns and receive specific practice problems based on the methods and techniques used.
Contribution
Contributions are welcome! If you have any ideas, bug fixes, or feature requests, feel free to submit a pull request or open an issue.

Made with 💻 and 🧠 by someone with too much free time.

### Key Sections:
- **Features**: Highlights what the package does.
- **Installation**: Shows how to install the package.
- **Usage**: Explains how to use the package after installation.
- **Roadmap**: Outlines future features, like real-time testing and file analysis.
- **Contribution**: Invites contributions from the community.

Feel free to adjust any section to match your needs. Let me know if you'd like to make any changes!