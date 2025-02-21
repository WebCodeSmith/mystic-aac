# Tibia Website

![Site Preview](/assets/site-preview.png)

## Prerequisites
- Node.js (v16+)
- npm
- Redis

## Redis Installation

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
   - Download Redis from official website: https://github.com/tporadowski/redis/releases
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
# Check Redis is running
redis-cli ping
# Should return "PONG"
```

## Database Configuration

### Prisma ORM

#### Prerequisites
- Node.js installed
- MySQL configured

#### Install Dependencies
```bash
npm install
```

### Database Setup

1. Copy `.env.example` to `.env` and configure your `DATABASE_URL`
   ```bash
   cp .env.example .env
   ```

2. Generate Prisma Client
   ```bash
   npx prisma generate
   ```

3. Create or Update Migrations
   ```bash
   # Create a new migration based on schema changes
   npx prisma migrate dev --name init

   # Apply migrations in production
   npx prisma migrate deploy
   ```

4. Database Utilities (Optional)
   ```bash
   # Open database viewer
   npx prisma studio

   # Reset database (CAUTION: Deletes all data)
   npx prisma migrate reset
   ```

### Troubleshooting
- Verify `DATABASE_URL` in `.env` is correct
- Ensure MySQL is running
- Confirm database user has sufficient permissions

## Setup
1. Clone the repository
2. Run `npm install`
3. Configure `.env` with Redis connection details
4. Run `npm run dev` for development
5. Run `npm run build` to compile TypeScript
6. Run `npm start` to run the production build

## Environment Configuration
Create a `.env` file in the root directory with the following variables:
```
# Database Connection
DATABASE_URL=mysql://username:password@localhost:3306/your_database

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Session Configuration
SESSION_SECRET=your_long_random_secret_key

# Logging
LOGGING_LEVEL=info

# Application Settings
PORT=3000
```

## Development
- `npm run dev`: Start development server
- `npm run build`: Compile TypeScript
- `npm run lint`: Run ESLint
- `npm test`: Run test suite

## Project Structure
```
project-root/
│
├── src/
│   ├── config/         # Configuration files
│   ├── middleware/     # Express middleware
│   ├── models/         # Database models
│   ├── routes/         # Express route definitions
│   ├── services/       # Business logic
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
│
├── views/              # EJS templates
│   ├── pages/          # Main page templates
│   └── partials/       # Reusable template components
│
├── public/             # Static assets
│   ├── css/
│   ├── js/
│   └── uploads/
│
├── tests/              # Test files
└── prisma/             # Prisma ORM configuration
```

## Technologies
- Node.js
- TypeScript
- Express.js
- Prisma ORM
- Redis (Session Management)
- EJS Templating
- MySQL Database

## Authentication
- Supports user registration and login
- Role-based access control
- Session management with Redis
- Password hashing for security

## Security Best Practices
- Input validation
- CSRF protection
- Rate limiting
- Secure session management
- Environment-based configuration

## Troubleshooting
- Ensure Redis is running before starting the application
- Check firewall settings if connection fails
- Verify Redis port (default: 6379) is not blocked
- Verify database connection strings
- Check npm package compatibility

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
Distributed under the MIT License. See `LICENSE` for more information.

## Contact
Discord Community: [Join our Discord Server](https://discord.gg/PcxCdKS)
