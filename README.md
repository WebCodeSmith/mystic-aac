
# Mystic AAC - Open Tibia Server Management Platform

## Description
Mystic AAC is a management platform for Open Tibia servers, built with modern technologies to provide a robust and scalable experience.

## Key Technologies
- **Backend**: Fastify
- **Database**: Prisma ORM
- **Authentication**: Secure sessions with Redis
- **Frontend**: EJS Templates
- **Language**: TypeScript
- **Configuration Management**: Zod Schema Validation

## Prerequisites
- Node.js (v18+)
- pnpm
- Redis
- PostgreSQL

## Installing Redis

### Windows
1. **Using Windows Subsystem for Linux (WSL2) (Recommended)**:
   ```bash
   # Install WSL2 and Ubuntu
   wsl --install
   
   # Open Ubuntu terminal and run:
   sudo apt update
   sudo apt install redis-server
   
   # Start Redis service
   sudo service redis-server start
   ```

2. **Manual Installation**:
   - Download Redis from the official site: https://github.com/tporadowski/redis/releases
   - Extract and run `redis-server.exe`
   - Add to PATH for command-line access

### macOS
```bash
brew update
brew install redis

# Start Redis service
brew services start redis
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Verify Redis Installation
```bash
# Check if Redis is running
redis-cli ping
# Should return "PONG"
```

## Installation

### Clone the Repository
```bash
git clone https://github.com/your-username/mystic-aac.git
cd mystic-aac
```

### Install Dependencies
```bash
pnpm install
```

### Set Up the Environment
1. Copy `.env.example` to `.env`
2. Fill in the required environment variables

### Database Configuration
```bash
pnpm prisma generate
pnpm prisma migrate dev
```

### Prisma Migrations and Utilities

#### Create or Update Migrations
```bash
# Create a new migration based on schema changes
pnpm prisma migrate dev --name init

# Apply migrations in production
pnpm prisma migrate deploy
```

#### Database Utilities (Optional)
```bash
# Open database viewer
pnpm prisma studio

# Reset database (WARNING: Deletes all data)
pnpm prisma migrate reset
```

#### Additional Prisma Commands
```bash
# Generate Prisma client
pnpm prisma generate

# Format Prisma schema
pnpm prisma format

# Validate Prisma schema
pnpm prisma validate
```

#### Troubleshooting
- Check if `DATABASE_URL` in `.env` is correct
- Ensure PostgreSQL is running
- Confirm the database user has sufficient permissions

### Run the Project
```bash
# Development mode
pnpm dev

# Production mode
pnpm build
pnpm start
```

## Project Structure
```
mystic-aac/
├── prisma/           # Database model definitions
├── public/           # Static files
├── src/
│   ├── config/       # App configurations
│   ├── middleware/   # Custom middlewares
│   ├── routes/       # Route definitions
│   ├── services/     # Business logic and services
│   ├── types/        # TypeScript type definitions
│   └── utils/        # Utilities
├── views/            # EJS templates
└── .env              # Environment configurations
```

## Main Features
- User authentication
- Account management
- Secure session system
- PostgreSQL database integration
- Schema validation with Zod
- Rate limiting
- Detailed logging

## Contributing
1. Fork the project
2. Create your feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License
This project is licensed under the MIT License.