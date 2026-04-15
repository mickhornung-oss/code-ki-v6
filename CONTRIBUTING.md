# Contributing Guidelines

Thank you for your interest in contributing to code-ki-v6! This document provides guidelines and instructions for contributing to this project.

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 16+ (for VS Code Extension)
- VS Code
- FastAPI knowledge

### Local Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/code-ki-v6.git`
3. Navigate to project: `cd code-ki-v6`

**Backend Setup:**
```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
python backend/run.py
```

**Extension Setup:**
```bash
cd vscode-extension
npm install
npm run watch
```

## Development Workflow

### Creating a Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### Code Guidelines
- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/) for Python
- Use TypeScript for extension code
- Add docstrings and type hints
- Keep functions focused and testable

### Testing
- Test backend endpoints: `python scripts/test_*.py`
- Test extension in VS Code Debug mode (F5)
- Validate model responses locally

## Submitting Changes

### Commit Messages
- Use clear, descriptive commit messages
- Format: `type: brief description`
- Examples: `feat: add new AI model`, `fix: API response timeout`, `docs: update setup guide`

### Pull Request Process
1. Push changes to your fork
2. Open a Pull Request with:
   - Clear title and description
   - Testing evidence (screenshots/logs)
   - Performance metrics if applicable
   - Related issues

3. Wait for review and address feedback

## Areas for Contribution

### Backend
- New AI model integrations
- API improvements
- Performance optimization

### Extension
- UI/UX enhancements
- New commands
- Settings improvements

### Documentation
- Setup guides
- Usage examples
- Architecture explanations

## Questions?

Feel free to:
- Open an Issue for feature requests or bugs
- Discuss in Discussions
- Email: [mick.hornung@googlemail.com](mailto:mick.hornung@googlemail.com)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Happy Contributing!** 🚀
