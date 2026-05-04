# VKsLab Backend - Realtime Dashboard Updates

This document explains how to use the realtime WebSocket functionality for live dashboard updates.

## Overview

The VKsLab backend now supports realtime updates using WebSocket connections via Socket.io. This allows the member dashboard to receive live updates when:

- Tasks are created or updated
- Reports are submitted
- Milestones are created or updated
- Project members are added or removed
- Project information is updated
- Git repository information is updated

## Backend Implementation

### WebSocket Server Setup

The WebSocket server is integrated into the main Express server (`src/server.js`) and uses JWT authentication for secure connections.

### Realtime Service (`src/services/realtime.service.js`)

Provides methods for:
- Authenticating WebSocket connections
- Managing user connections and rooms
- Broadcasting updates to specific users or project members
- Sending notifications

### Updated Controllers

The following controllers now broadcast realtime updates:
- `src/controllers/project.controller.js` - All project-related operations

## Frontend Integration

### Installation

First, install Socket.io client in your frontend project:

```bash
npm install socket.io-client
```

### Basic Usage

```javascript
import io from 'socket.io-client';
import RealtimeDashboardClient from './RealtimeDashboardClient';

// Initialize client
const realtimeClient = new RealtimeDashboardClient();

// Connect with JWT token
const token = localStorage.getItem('accessToken');
realtimeClient.connect(token);
```

### Handling Updates

The client automatically handles different types of updates:

```javascript
// Dashboard updates (personal dashboard data)
socket.on('dashboard_update', (data) => {
  console.log('Dashboard update:', data);
  // data.type: 'task_created', 'task_updated', 'report_created', etc.
  // data.data: The actual update data
  // Refresh your dashboard UI
});

// Project updates (project-specific notifications)
socket.on('project_update', (data) => {
  console.log('Project update:', data);
  // Show notifications for project changes
});

// General notifications
socket.on('notification', (notification) => {
  console.log('Notification:', notification);
  // Show notification to user
});
```

### Subscribing to Updates

```javascript
// Subscribe to dashboard updates (automatic on connect)
socket.emit('subscribe_dashboard');

// Subscribe to specific project updates
socket.emit('subscribe_project', projectId);
```

## Update Types

### Dashboard Updates
- `task_created` - New task created
- `task_updated` - Task modified
- `report_created` - New report submitted
- `milestone_created` - New milestone added
- `milestone_updated` - Milestone modified
- `member_added` - New member added to project
- `member_removed` - Member removed from project
- `project_updated` - Project information updated
- `git_repo_updated` - Git repository information updated

### Project Updates
All dashboard update types are also broadcasted as project updates to all project members.

## Authentication

WebSocket connections require JWT authentication:

```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

Or via query parameter:
```
ws://localhost:3000?token=your-jwt-token
```

## Error Handling

The client includes automatic reconnection with exponential backoff:

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
  // Client will attempt to reconnect automatically
});
```

## Complete Example

See `frontend-example.js` for a complete implementation of a RealtimeDashboardClient class that handles:

- Connection management
- Automatic reconnection
- Update handling
- UI notifications
- Dashboard refresh logic

## API Reference

### RealtimeService Methods

```javascript
// Broadcast to specific user dashboard
realtimeService.broadcastDashboardUpdate(userId, updateType, data);

// Broadcast to all project members
realtimeService.broadcastProjectUpdate(projectId, updateType, data);

// Send notification to user
realtimeService.sendNotification(userId, notification);

// Check connection status
realtimeService.isUserConnected(userId);
```

### Socket Events

#### Client to Server
- `subscribe_dashboard` - Subscribe to dashboard updates
- `subscribe_project` - Subscribe to project updates

#### Server to Client
- `dashboard_update` - Dashboard data updates
- `project_update` - Project-specific updates
- `notification` - General notifications

## CORS Configuration

The WebSocket server is configured with CORS to allow connections from frontend applications. Update the CORS origins in `src/server.js` as needed.

## Testing

To test the realtime functionality:

1. Start the backend server
2. Connect a WebSocket client (use the frontend example)
3. Perform operations like creating tasks or submitting reports
4. Observe realtime updates in the client

## Performance Considerations

- Users are automatically joined to their personal dashboard room
- Project broadcasts only go to project members
- Connection limits and rate limiting can be added as needed
- Consider implementing message queuing for high-traffic scenarios