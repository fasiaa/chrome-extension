 # UIGENIE

**Extract and Analyze Website Designs with AI-Powered Precision**

Transform any website into a complete design system, UI theme, or inspiration guide with Mysia's powerful Chrome extension. Built with cutting-edge AI technology and Google's Gemini API, our extension provides unparalleled insights into website design and structure.

## Features

### Theme Extraction
- Extract complete color palettes, typography, and spacing systems
- Generate structured UI theme prompts for design reproduction
- Identify primary colors, fonts, and design tokens
- Create ready-to-use CSS variables and style guides

### Full Site Analysis
- Comprehensive HTML and CSS extraction
- Component hierarchy identification
- Responsive design pattern detection
- Complete website recreation prompts

### Design Inspiration
- Analyze design philosophies and approaches
- Extract color strategies and typography choices
- Identify layout patterns and component designs
- Generate mood and feel descriptions

##  Quick Start

### Installation

1. **Download the Extension**
   - Clone or download this repository
   - Navigate to `chrome://extensions/` in your Chrome browser
   - Enable "Developer mode" toggle
   - Click "Load unpacked" and select the extension folder

2. **Get Your API Key**
   - Visit [Google AI Studio](https://aistudio.google.com/app/api-key)
   - Create a new project or select an existing one
   - Generate your Gemini API key
   - Copy the API key for setup

3. **Setup Your Extension**
   - Click the Mysia extension icon in your Chrome toolbar
   - Enter your Gemini API key in the popup
   - Your key will be securely saved for future use

### Usage

1. **Navigate to any website** you want to analyze
2. **Click the Mysia extension icon**
3. **Select your analysis mode**:
   - **Theme Extract**: Get color palettes, fonts, and design tokens
   - **Full Copy**: Complete website structure and styling analysis
   - **Inspiration**: Design patterns and creative insights
4. **Wait for processing** (typically 10-30 seconds)
5. **Copy your AI-generated prompt** and use it in your design workflow

## Technical Details

### Architecture

The extension follows a modular architecture with three main components:

- **`popup.html`**: User interface for API key management and analysis control
- **`content.js`**: Page content extraction and data collection
- **`background.js`**: AI model communication and response processing

### API Integration

- **Google Gemini API**: Powers all AI analysis and content generation
- **Secure Storage**: API keys are stored locally using Chrome's storage API
- **Error Handling**: Comprehensive error handling for network issues and API limits

### Data Processing

1. **Content Extraction**: Collects HTML, CSS, and computed styles
2. **Data Optimization**: Truncates large content to avoid API limits
3. **AI Analysis**: Sends structured data to Gemini for analysis
4. **Response Formatting**: Converts AI responses to user-friendly prompts

##  Development

### Project Structure

```
theme-chrome-extension/
├── manifest.json          # Extension configuration
├── background.js          # Background script for API communication
├── content.js            # Content script for page analysis
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── config.json           # Application configuration
├── icons/                # Extension icons
│   ├── icon16.png        # Extension icon (16x16)
│   ├── icon48.png        # Extension icon (48x48)
│   └── icon128.png       # Extension icon (128x128)
├── manual.md             # User manual
├── tasks.md              # Project tasks and roadmap
├── LICENSE               # License file
└── README.md             # This file
```

### Building the Extension

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mysia-extension
   ```

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable Developer mode
   - Click "Load unpacked" and select the extension directory

3. **Testing**
   - Visit any website
   - Click the extension icon
   - Test all three analysis modes
   - Verify API key functionality

### Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Requirements

- **Google Chrome** (version 80 or later)
- **Google Gemini API Key** (free tier available)
- **Internet connection** for API communication

## Privacy & Security

- **No Data Collection**: We don't collect or store any user data
- **Local Storage**: API keys are stored only in your browser
- **Secure Communication**: All API calls use HTTPS encryption
- **No Tracking**: No analytics or telemetry data is collected

## Troubleshooting

### Common Issues

**"API key not valid" Error**
- Verify your API key is correct
- Check if the key is being used in other projects simultaneously
- Ensure your Google AI Studio project is active

**Timeout Errors**
- Check your internet connection
- Try analyzing simpler websites first
- Verify API quota limits in Google AI Studio

**Extension Not Loading**
- Ensure Developer mode is enabled in Chrome extensions
- Check console for JavaScript errors
- Verify all required files are present

### Getting Help

- **Documentation**: Check `manual.md` for detailed usage instructions
- **Issues**: Report bugs or feature requests on our GitHub repository
- **Support**: Contact us through our official channels

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Google AI Studio**: For providing the powerful Gemini API
- **Chrome Extension API**: For enabling seamless browser integration
- **Our Users**: For inspiring continuous improvement

---

## 💌 About Mysia

We're not just building tools - we're building the future we wish existed when we were scraping together ramen noodles and debugging at 3 AM. This is our rebellion against the broken status quo, one line of code at a time.

**Made with ❤️ by Mysia**

**Happy Coding! :)**

---

