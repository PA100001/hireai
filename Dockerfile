# Use official Node image
FROM node:18

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Expose backend port (adjust if needed)
EXPOSE 8080

# Run the app
CMD ["npm", "start"]
