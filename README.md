# Warper

**Warper** is a open source professional grade tool designed for precise correction of lens distortion in photography—especially portraits captured with wide-angle lenses. Traditional lens correction algorithms often fall short, as they apply generic adjustments that do not account for subject distance or the nuanced physics of portraiture. This can leave facial features looking disproportionate or unnatural, even after automatic correction.

Warper addresses this challenge by empowering photographers and retouchers to manually restore natural proportions with intuitive, physics-aware control. At its core is a high-fidelity displacement brush, operating in a true 3D texture space. Each brush stroke applies a custom GPU-accelerated displacement shader, enabling subtle, artifact-free adjustments that preserve the integrity of the image. The pipeline is fully color-managed, respecting embedded ICC profiles and EXIF metadata to ensure professional-grade results from start to finish.

---

## Features

### Advanced Image Processing

- **Intuitive Displacement Brush** – Manual, physics-aware warping for natural, low-distortion results
- **WebGL-Powered Rendering** – Hardware-accelerated image processing with Three.js
- **Color Management** – Full ICC profile support with wide gamut color spaces (Adobe RGB, ProPhoto RGB)
- **HDR Export** – High dynamic range image export capabilities
- **EXIF Preservation** – Maintains original image metadata and color profiles

### Professional Tools

- **Precision Brush System** – Adjustable size and strength with real-time preview
- **Multi-level Undo/Redo** – Comprehensive history management (15 levels)
- **Zoom & Pan** – Smooth viewport navigation with keyboard shortcuts
- **Compare Mode** – Side-by-side original vs. edited comparison
- **Format Support** – JPEG, PNG, WebP, HEIC/HEIF with automatic conversion

### Performance & UX

- **React Compiler** – Automatic memoization for optimal performance
- **Progressive Web App** – Offline support with service worker
- **Responsive Design** – Professional UI with Tailwind CSS
- **Keyboard Shortcuts** – Efficient workflow with familiar hotkeys
- **Touch Support** – Full mobile and tablet compatibility

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Graphics**: Three.js + WebGL shaders
- **Styling**: Tailwind CSS 4.x
- **Build**: Vite 7 with React Compiler
- **Color**: ICC profile processing with `exifr`
- **PWA**: Service worker with offline capabilities

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/warper.git
cd warper

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

### Development Commands

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Run ESLint
```

## Architecture

### Core Components

- **WarpCanvas** - WebGL rendering engine with custom shaders
- **WarperContext** - Centralized state management with React Context
- **Brush System** - Real-time displacement painting
- **Export Pipeline** - Color-managed image export with EXIF preservation

### Shader Pipeline

- **Brush Shader** - Displacement map generation
- **Display Shader** - Color-corrected image rendering with tone mapping
- **Linear Color Space** - Proper gamma handling throughout the pipeline

### Color Management

- **ICC Profile Detection** - Automatic wide gamut profile identification
- **sRGB Conversion** - Canvas-based color space conversion
- **Gamma Correction** - Conditional gamma application for accurate colors

## Performance Optimizations

- **React Compiler** - Automatic component memoization
- **WebGL Textures** - Efficient GPU memory management
- **History Pruning** - Automatic cleanup of old undo states

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

WebGL 2.0 and modern JavaScript features required.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Use React Compiler best practices
- Maintain color management accuracy
- Test across different image formats
- Ensure accessibility compliance

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Three.js community for WebGL excellence
- React team for the new compiler
- Color science community for ICC profile standards
- Open source contributors making this possible
