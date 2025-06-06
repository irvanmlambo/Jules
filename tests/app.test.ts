import request from 'supertest';
import app from '../src/app'; // Your Express app
import pool from '../config/db'; // Your database pool

// Mock the database pool
jest.mock('../config/db', () => {
  const mPool = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
  };
  return {
    __esModule: true, // Default export
    default: mPool,
  };
});

describe('Task API', () => {
  let mockQuery: jest.Mock;

  beforeEach(() => {
    // Reset the mock before each test
    mockQuery = pool.query as jest.Mock;
    mockQuery.mockReset();
  });

  describe('GET /tasks', () => {
    it('should return an empty array when no tasks exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return tasks when tasks exist', async () => {
      const tasks = [{ id: 1, title: 'Test Task', description: 'Test Desc', completed: false }];
      mockQuery.mockResolvedValueOnce({ rows: tasks });
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(tasks);
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('POST /tasks', () => {
    it('should create a new task', async () => {
      const newTask = { title: 'New Task', description: 'New Desc' };
      const createdTask = { id: 1, ...newTask, completed: false };
      mockQuery.mockResolvedValueOnce({ rows: [createdTask] });

      const res = await request(app).post('/tasks').send(newTask);
      expect(res.status).toBe(201);
      expect(res.body).toEqual(createdTask);
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING *',
        [newTask.title, newTask.description]
      );
    });

    it('should return 400 if title is missing', async () => {
      const res = await request(app).post('/tasks').send({ description: 'No title' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Title is required' });
    });

     it('should handle database errors during creation', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));
      const res = await request(app).post('/tasks').send({ title: 'Error Task' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('GET /tasks/:id', () => {
    it('should return a single task if found', async () => {
      const task = { id: 1, title: 'Found Task', description: 'Desc', completed: false };
      mockQuery.mockResolvedValueOnce({ rows: [task] });
      const res = await request(app).get('/tasks/1');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(task);
      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM tasks WHERE id = $1', ['1']);
    });

    it('should return 404 if task not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/tasks/99');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    it('should handle database errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));
      const res = await request(app).get('/tasks/1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should update an existing task', async () => {
      const existingTask = { id: 1, title: 'Old Task', description: 'Old Desc', completed: false };
      const updates = { title: 'Updated Task', completed: true };
      const updatedTask = { ...existingTask, ...updates };

      // Mock for checking if task exists
      mockQuery.mockResolvedValueOnce({ rows: [existingTask] });
      // Mock for the update operation
      mockQuery.mockResolvedValueOnce({ rows: [updatedTask] });

      const res = await request(app).put('/tasks/1').send(updates);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(updatedTask);
      expect(mockQuery).toHaveBeenCalledWith(
        'UPDATE tasks SET title = $1, description = $2, completed = $3 WHERE id = $4 RETURNING *',
        [updates.title, existingTask.description, updates.completed, '1']
      );
    });

    it('should return 404 if task to update is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Task not found
      const res = await request(app).put('/tasks/99').send({ title: 'Non Existent' });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    it('should return 400 if no update fields are provided', async () => {
      const res = await request(app).put('/tasks/1').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'No fields to update provided' });
    });

    it('should handle database errors during update', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Task to fail update' }] }); // Task exists
      mockQuery.mockRejectedValueOnce(new Error('DB Error')); // Update fails
      const res = await request(app).put('/tasks/1').send({ title: 'Update Fail' });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete a task and return 204', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, title: 'Task to delete' }] }); // Mock deletion successful
      const res = await request(app).delete('/tasks/1');
      expect(res.status).toBe(204);
      expect(mockQuery).toHaveBeenCalledWith('DELETE FROM tasks WHERE id = $1 RETURNING *', ['1']);
    });

    it('should return 404 if task to delete is not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Task not found
      const res = await request(app).delete('/tasks/99');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });

    it('should handle database errors during deletion', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB Error'));
      const res = await request(app).delete('/tasks/1');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });
  });
});
