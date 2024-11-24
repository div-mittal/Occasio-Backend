# Use Node.js v18.14.2 as the base image
FROM node:18.14.2

# Set the working directory
WORKDIR /server

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port your application runs on (if applicable, replace 3000 with your app's port)
EXPOSE 3000

# Command to run your application
CMD ["npm", "run", "dev"]
