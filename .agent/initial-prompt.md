Create a plan to build a new app, and save the plan in a file called .agent/plan00.md

Dont implement anything yet, just create the planning doc. And dont ask any follow up questions. Create a section in the planning doc called “important questions” and, If something is unclear, add a question to this section. Think very very hard!! Ultrathink

The app should be written in nextjs. It should use Convex for database, file storage, backend functions, and auth. The only auth method is Google oauth.

The app is a text editor. The main screen has a large text editing panel (full height of the window, minus UI elements as needed, 2/3 width of the window). To the right of the editing panel is an AI assistant panel (same height, 1/3 width of the window).

The UI elements at the top of the window are (each button opens a modal):
Create a new file
open a file stored on the server
Share..
Settings

All files are stored as markdown. Only markdown files can be uploaded. 

The editing panel has two modes: ​rendered and raw. In rendered mode, there is a rich text editor with various buttons for formatting, etc. In raw mode, it displays the raw markdown file in a coding type editor. There should be small buttons at the bottom of the pane to switch modes. 

The ai assistant panel is a chat interface. It should look a lot like the cursor ai panel, with text input at the bottom for a prompt, and a model selector underneath that. It should support the latest models from openai, Anthropic, and Google. The prompt should be minimal to start: it should send the full doc as context and ask the model to implement the prompt requested by the user. After every user submitted query, there should be a simple loop that calls the same model again up to 3 times. The prompt for this query is: check that the change has been implemented correctly, and say OK if so, or make more changes if not. 

I'm not sure how exactly the model replies should be applied. if the models can reliably return a diff, that's probably better. Or if they only return full docs, then the full doc should just be replaced in the editor. 

In the plan, include some ideas for how handle context filling if the doc is too long to send in context, but don't choose an approach yet.

The app should have granular versioning. I.e. a diff is stored after every agent call, and the prompt associated with that diff should be stored in the db, along with the diff id/ filename. I've been saying “file” this whole time, but id like your advice whether its better to store markdown and diffs as files or in the db. Diffs should also be saved if the editor is idle for 5 seconds and changes are detected. 

The app should also support commments and real time collaborative editing. Convex should make this easy. Please include this design consideration when deciding how to store files. Users should be able to see the cursor, selection, etc of other users. This means of course that there should be a way to track permissions and owners for each file.
