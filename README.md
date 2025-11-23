# photoast 📸

Web-based instant photo printing platform for events using Next.js and Epson Email Print.

## Features

### For Event Organizers (Admin)
- Create and manage events
- Upload event logos with customizable positioning
- Generate QR codes for guest access
- View print job history
- Simple authentication system

### For Guests
- Scan QR code or use URL to access event
- Multiple layout options:
  - **Single Photo**: 1 photo with optional logo
  - **Life Four-Cut (네컷)**: 4 photos in dual strips (cut-ready)
  - **2×2 Grid**: 4 photos in grid layout
- Photo crop editor with zoom/pan controls
- Photo reordering for multi-photo layouts
- 10 background color presets
- Preview processed photo
- Print instantly via email to Epson printer

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: In-memory (MongoDB support available)
- **Image Processing**: Sharp
- **Styling**: Tailwind CSS
- **Printing**: Epson Email Print (via nodemailer)
- **Email**: SMTP (Gmail/Outlook/Custom)

## Getting Started

### Prerequisites

- Node.js 18+ (Note: Node 20+ recommended for latest Next.js)
- SMTP email account (Gmail, Outlook, or custom)
- Epson printer with Email Print enabled (or for testing only)

### Installation

1. Clone the repository:
```bash
cd photoast
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure SMTP settings:
```env
# For Gmail (recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Get from https://myaccount.google.com/apppasswords
SMTP_FROM=your-email@gmail.com
```

📧 **Detailed SMTP setup guide**: See [EMAIL_PRINT_SETUP.md](./EMAIL_PRINT_SETUP.md)

4. Start development server:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```
MONGODB_URI=mongodb://localhost:27017/photoast
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

4. Start MongoDB (if running locally):
```bash
mongod
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Admin Dashboard

1. Navigate to `/admin`
2. Login with credentials from `.env`
3. Create a new event:
   - Enter event name
   - Provide IPP printer URL (e.g., `ipp://192.168.1.100:631/printers/printer1`)
4. Upload a logo (optional)
5. Generate and display QR code
6. Share the QR code or URL with guests

### Guest Flow

1. Scan QR code or visit event URL (e.g., `http://localhost:3000/birthday-party-xyz`)
2. Click "Choose Photo" to select an image
3. Wait for processing (resize + logo overlay)
4. Review the preview
5. Click "Print Photo" to send to printer
6. Photo will print at 5x7 inch size

## Project Structure

```
photoast/
├── app/
│   ├── [slug]/           # Guest page (dynamic route)
│   ├── admin/            # Admin dashboard
│   ├── api/
│   │   ├── auth/         # Authentication endpoints
│   │   ├── events/       # Event management
│   │   ├── upload/       # File upload
│   │   ├── process-image/# Image processing
│   │   └── print/        # Print job handling
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx          # Home page
├── lib/
│   ├── auth.ts           # Authentication utilities
│   ├── image.ts          # Image processing (Sharp)
│   ├── middleware.ts     # Auth middleware
│   ├── models.ts         # Database models
│   ├── mongodb.ts        # MongoDB connection
│   ├── printer.ts        # IPP printer integration
│   └── types.ts          # TypeScript types
├── public/
│   └── uploads/          # Uploaded images
├── .env                  # Environment variables
├── mvp.md               # MVP specification
├── next.config.js
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout

### Events
- `GET /api/events` - List all events (auth required)
- `POST /api/events` - Create event (auth required)
- `GET /api/events/[id]` - Get event by ID (auth required)
- `PATCH /api/events/[id]` - Update event (auth required)
- `GET /api/events/slug/[slug]` - Get event by slug (public)

### Images & Printing
- `POST /api/upload` - Upload file (logo or photo)
- `POST /api/process-image` - Process photo (resize + logo)
- `POST /api/print` - Send print job to Epson Email Print
- `GET /api/serve-image/[filename]` - Serve uploaded images (for Vercel /tmp access)

## Image Specifications

- **Output Size**: 4x6 inch (1200x1800 pixels at 300 DPI)
- **Print Size**: 4x6 inch (102x152mm)
- **Format**: JPEG
- **Quality**: 95%
- **Logo**: Customizable size and position
- **Printer Correction**: 95.25% shrink + -5px vertical offset (compensates for borderless printing)

## Notes

- The IPP printer integration is currently simulated in development
- For production, ensure your printer supports IPP protocol
- Default admin credentials should be changed in production
- MongoDB should be properly secured for production use
- **Local**: File uploads stored in `public/uploads` directory
- **Vercel**: File uploads stored in `/tmp` directory (temporary, cleared on function restart)
  - ⚠️ For production on Vercel, consider using [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob) or external storage (S3, Cloudinary) for persistent file storage

## Vercel Deployment

This app is ready to deploy on Vercel with the following considerations:

1. **Environment Variables**: Set all required environment variables in Vercel dashboard:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `NEXT_PUBLIC_BASE_URL`
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

2. **File Storage**: The app automatically detects Vercel environment and uses `/tmp` directory for file uploads. This is temporary storage that gets cleared on function restarts.
   - Uploaded logos and processed images are stored temporarily in `/tmp/uploads`
   - Images are served via `/api/serve-image/[filename]` route (since `/tmp` is not publicly accessible)
   - For persistent storage, consider upgrading to Vercel Blob Storage or external storage service

3. **Deploy**:
   ```bash
   vercel
   ```

## Development

Run in development mode:
```bash
npm run dev
```

Build for production:
```bash
npm run build
npm start
```

Run linter:
```bash
npm run lint
```

## License

MIT
