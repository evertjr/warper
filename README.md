# Warper - Professional Image Warping Tool

A professional-grade image warping application built with Next.js, React, Three.js, and WebGL shaders. Warper provides real-time, non-destructive image manipulation with advanced brush controls and high-quality export capabilities.

## Features

### Core Functionality

- **Real-time Image Warping**: Interactive brush-based warping with instant visual feedback
- **Non-destructive Editing**: Uses displacement maps to preserve original image quality
- **Undo/Redo System**: Complete history management with unlimited undo/redo operations
- **Pan & Zoom**: Smooth navigation with mouse/trackpad support and touch gestures for mobile

### Brush Controls

- **Adjustable Brush Size**: Precise control from 10px to 200px
- **Variable Strength**: Fine-tune warp intensity from 0% to 100%
- **Edge Softness**: Control brush falloff for smooth or sharp edges
- **Visual Brush Preview**: Real-time cursor preview showing exact brush area

### Advanced Features

- **High-Resolution Processing**: Maintains original image resolution for export
- **Multiple Format Support**: JPEG, PNG, WebP, and HEIF/HEIC images
- **HDR Export**: Preserve highlight detail with Radiance HDR (.hdr) format export
- **Color Accurate**: Proper gamma correction and color space handling
- **Mobile Optimized**: Touch-friendly interface with gesture support

### Export Options

- **Standard Export**: High-quality JPEG/PNG with preserved filename
- **HDR Export**: Radiance HDR format for professional workflows
- **Original Resolution**: Export at full source image resolution

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd warper

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to use the application.

## Usage

### Basic Workflow

1. **Load Image**: Click to select an image file or drag & drop
2. **Adjust Brush**: Use the right panel to set size, strength, and edge softness
3. **Warp Image**: Click and drag on the image to apply warping effects
4. **Navigate**: Use Space+drag to pan, mouse wheel to zoom
5. **Export**: Choose standard or HDR export from the export menu

### Controls

#### Desktop

- **Warp**: Click and drag with mouse
- **Pan**: Hold Space + drag
- **Zoom**: Mouse wheel (Ctrl+wheel for trackpad pinch)
- **Undo/Redo**: Toolbar buttons or keyboard shortcuts

#### Mobile/Touch

- **Warp**: Single finger tap and drag
- **Pan**: Two-finger drag
- **Zoom**: Pinch gesture

### Brush Settings

- **Size (10-200px)**: Controls the diameter of the warp effect
- **Strength (0-100%)**: Intensity of the warping displacement
- **Edge Softness (0-100%)**: Falloff from center to edge of brush
- **Zoom (25-400%)**: Display zoom level for precise editing

## Technical Architecture

### Core Technologies

- **Next.js 14**: React framework with App Router
- **React Three Fiber**: React renderer for Three.js
- **Three.js**: WebGL 3D graphics library
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling

### Rendering Pipeline

1. **Displacement Mapping**: Brush strokes accumulate displacement vectors
2. **Ping-Pong Rendering**: Alternates between two framebuffers for real-time updates
3. **High-Precision Sampling**: Uses original image resolution for quality preservation
4. **Color Space Management**: Proper sRGB/Linear conversion for accurate colors

### Shader System

- **BrushShader**: Accumulates displacement data with smooth falloff
- **DisplayShader**: Samples original image using displacement map
- **ExportShader**: Renders final result with gamma correction

## File Structure

```
src/
├── app/
│   ├── page.tsx          # Main application page
│   ├── WarpCanvas.tsx    # Core warping component
│   ├── layout.tsx        # App layout
│   └── globals.css       # Global styles
├── public/               # Static assets
└── ...
```

## Browser Support

- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **WebGL 2.0**: Required for high-performance rendering
- **File API**: For drag & drop and file selection
- **WebCodecs**: For advanced image format support (HEIF/HEIC)

## Performance Considerations

- **GPU Acceleration**: All rendering operations use WebGL shaders
- **Memory Efficient**: Displacement-based architecture minimizes texture memory
- **Responsive**: Optimized for real-time interaction at 60fps
- **Scalable**: Handles images up to GPU maximum texture size

## Export Formats

### Standard Export

- **JPEG**: Default for photos, smaller file size
- **PNG**: For images requiring transparency
- **Quality**: Lossless warping with gamma-corrected output

### HDR Export

- **Radiance HDR**: Industry-standard HDR format
- **Linear Color Space**: Preserves highlight detail
- **Professional Workflow**: Compatible with HDR-aware applications

## Development

### Building for Production

```bash
pnpm build
pnpm start
```

### Linting and Type Checking

```bash
pnpm lint
pnpm type-check
```

## Contributing

This project uses modern web technologies and follows best practices for performance and code quality. Contributions are welcome!

## License

MIT License
