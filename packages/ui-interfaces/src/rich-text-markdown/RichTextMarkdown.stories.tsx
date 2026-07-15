import type { Meta, StoryObj } from '@storybook/react';
import { RichTextMarkdown } from './RichTextMarkdown';

const meta: Meta<typeof RichTextMarkdown> = {
  title: 'Interfaces/RichTextMarkdown',
  component: RichTextMarkdown,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `A Markdown editor with WYSIWYG editing and a raw-source mode.

## Features
- WYSIWYG Markdown editing (renders as you type — the editor is the preview)
- Editable raw Markdown "Source" mode (monospace)
- Syntax highlighting for code blocks
- Table insertion
- Image support
- Custom syntax extensions
- Multiple font options

## Usage
\`\`\`tsx
import { RichTextMarkdown } from '@buildpad/ui-interfaces';

<RichTextMarkdown
  label="README"
  value={markdown}
  onChange={(md) => setMarkdown(md)}
  placeholder="Write Markdown..."
/>
\`\`\``,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'text',
      description: 'Current value of the editor (Markdown string)',
    },
    label: {
      control: 'text',
      description: 'Field label',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the editor is disabled',
    },
    required: {
      control: 'boolean',
      description: 'Whether the field is required',
    },
    error: {
      control: 'text',
      description: 'Error message',
    },
    toolbar: {
      control: 'object',
      description: 'Toolbar configuration',
    },
    softLength: {
      control: 'number',
      description: 'Soft character length limit',
    },
    editorFont: {
      control: 'select',
      options: ['sans-serif', 'serif', 'monospace'],
      description: 'Editor font family',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Content',
    placeholder: 'Start typing...',
  },
};

export const WithValue: Story = {
  args: {
    label: 'README',
    value: `# Project Title

A brief description of what this project does.

## Features

- Feature one
- Feature two  
- Feature three

## Installation

\`\`\`bash
npm install my-package
\`\`\`

## Usage

\`\`\`javascript
import { example } from 'my-package';

example();
\`\`\`
`,
  },
};

export const DocumentationStyle: Story = {
  args: {
    label: 'Documentation',
    editorFont: 'monospace',
    value: `# API Reference

## \`getUser(id)\`

Fetches a user by ID.

**Parameters:**
- \`id\` (string) - The user's unique identifier

**Returns:** Promise<User>

**Example:**
\`\`\`typescript
const user = await getUser('123');
console.log(user.name);
\`\`\`
`,
  },
};

export const BlogPost: Story = {
  args: {
    label: 'Blog Post',
    editorFont: 'serif',
    value: `# My First Blog Post

*Published on December 13, 2024*

Welcome to my blog! This is an introductory post where I'll share my thoughts.

## What to Expect

I'll be writing about:

1. Web development
2. Design patterns
3. Best practices

> "The best way to learn is by doing." - Someone wise

Stay tuned for more content!
`,
  },
};

export const WithCodeBlocks: Story = {
  args: {
    label: 'Technical Note',
    editorFont: 'monospace',
    value: `# Code Examples

Here's some JavaScript:

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

And some TypeScript:

\`\`\`typescript
interface User {
  id: string;
  name: string;
}

const getUser = (id: string): User => {
  return { id, name: 'John' };
};
\`\`\`

Inline code looks like \`this\`.
`,
  },
};

export const CustomToolbar: Story = {
  args: {
    label: 'Simple Notes',
    toolbar: ['heading', 'bold', 'italic', 'bullist', 'numlist', 'link'],
    placeholder: 'Take notes...',
  },
};

export const WithSoftLength: Story = {
  args: {
    label: 'Summary',
    softLength: 300,
    placeholder: 'Write a brief summary...',
  },
};

export const Required: Story = {
  args: {
    label: 'Required Field',
    required: true,
    placeholder: 'This field is required',
  },
};

export const WithError: Story = {
  args: {
    label: 'Content',
    error: 'Please enter valid Markdown content',
    value: '',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled',
    disabled: true,
    value: '# Disabled Content\n\nThis editor is disabled.',
  },
};

export const TableExample: Story = {
  args: {
    label: 'With Tables',
    value: `# Data Table

| Name | Age | City |
|------|-----|------|
| John | 30 | NYC |
| Jane | 25 | LA |
| Bob | 35 | Chicago |

This table shows sample data.
`,
  },
};

export const ChangelogStyle: Story = {
  args: {
    label: 'Changelog',
    editorFont: 'monospace',
    value: `# Changelog

## [1.2.0] - 2024-12-13

### Added
- New feature X
- Support for Y

### Changed
- Improved performance
- Updated dependencies

### Fixed
- Bug in component A
- Issue with module B

## [1.1.0] - 2024-12-01

### Added
- Initial release
`,
  },
  parameters: {
    docs: {
      description: {
        story: 'Changelog format following Keep a Changelog conventions.',
      },
    },
  },
};

export const READMETemplate: Story = {
  args: {
    label: 'README.md',
    editorFont: 'monospace',
    placeholder: 'Write your README...',
    value: `# Project Name

Short description of the project.

## Installation

\`\`\`bash
npm install project-name
\`\`\`

## Usage

\`\`\`javascript
const project = require('project-name');
project.doSomething();
\`\`\`

## API

### method(options)

Description of the method.

## Contributing

Pull requests are welcome.

## License

MIT
`,
  },
  parameters: {
    docs: {
      description: {
        story: 'Standard README.md template.',
      },
    },
  },
};
