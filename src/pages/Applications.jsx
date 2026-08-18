import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Building2, MapPin, Trash2, Sparkles, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const initialColumns = {
  'col-1': { id: 'col-1', title: 'Saved 📌', taskIds: [] },
  'col-2': { id: 'col-2', title: 'Preparing ✍️', taskIds: [] },
  'col-3': { id: 'col-3', title: 'Applied 🚀', taskIds: [] },
  'col-4': { id: 'col-4', title: 'Interview 🎙️', taskIds: [] },
  'col-5': { id: 'col-5', title: 'Offer 🎉', taskIds: [] },
};

export default function Applications() {
  const [data, setData] = useState({ columns: initialColumns, tasks: {}, columnOrder: Object.keys(initialColumns) });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedApplications();
  }, []);

  async function fetchSavedApplications() {
    setLoading(true);
    try {
      const { data: apps, error } = await supabase
        .from('user_applications')
        .select('id, status, global_opportunities(*)');

      if (error) throw error;

      const newTasks = {};
      const newColumns = JSON.parse(JSON.stringify(initialColumns)); // Deep copy

      apps.forEach(app => {
        const opp = app.global_opportunities;
        if (opp) {
          newTasks[app.id] = {
            id: app.id,
            title: opp.title,
            org: opp.organization,
            country: opp.country,
            type: opp.type
          };
          
          if (newColumns[app.status]) {
            newColumns[app.status].taskIds.push(app.id);
          } else {
            newColumns['col-1'].taskIds.push(app.id);
          }
        }
      });

      setData({
        tasks: newTasks,
        columns: newColumns,
        columnOrder: Object.keys(initialColumns)
      });
    } catch (err) {
      console.error('Error fetching applications:', err.message);
    } finally {
      setLoading(false);
    }
  }

  // --- NEW: Handle Deletion ---
  const handleDelete = async (taskId, columnId) => {
    // 1. Optimistic UI Update (remove it instantly from screen)
    const column = data.columns[columnId];
    const newTaskIds = Array.from(column.taskIds);
    newTaskIds.splice(newTaskIds.indexOf(taskId), 1);
    
    const newColumn = { ...column, taskIds: newTaskIds };
    
    setData(prev => ({
      ...prev,
      columns: { ...prev.columns, [columnId]: newColumn }
    }));

    // 2. Database Update
    try {
      const { error } = await supabase
        .from('user_applications')
        .delete()
        .eq('id', taskId);
        
      if (error) throw error;
    } catch (err) {
      console.error("Failed to delete application", err);
      alert("Error deleting application. Refreshing data...");
      fetchSavedApplications(); // Re-fetch if it failed
    }
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const startCol = data.columns[source.droppableId];
    const finishCol = data.columns[destination.droppableId];

    // Same Column
    if (startCol === finishCol) {
      const newTaskIds = Array.from(startCol.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);

      const newColumn = { ...startCol, taskIds: newTaskIds };
      setData({ ...data, columns: { ...data.columns, [newColumn.id]: newColumn } });
      return;
    }

    // Different Column
    const startTaskIds = Array.from(startCol.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStart = { ...startCol, taskIds: startTaskIds };

    const finishTaskIds = Array.from(finishCol.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinish = { ...finishCol, taskIds: finishTaskIds };

    setData({
      ...data,
      columns: { ...data.columns, [newStart.id]: newStart, [newFinish.id]: newFinish },
    });

    try {
      await supabase
        .from('user_applications')
        .update({ status: destination.droppableId })
        .eq('id', draggableId);
    } catch (err) {
      console.error("Failed to save drag position to database", err);
    }
  };

  return (
    <div className="space-y-8 pb-10 h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            My Applications
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            Drag and drop to track your progress across global opportunities.
          </p>
        </div>
        <button className="hidden sm:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm">
          <Sparkles className="w-4 h-4" /> AI Copilot
        </button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 scrollbar-none">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-6 h-full items-start">
              {data.columnOrder.map((columnId) => {
                const column = data.columns[columnId];
                const tasks = column.taskIds.map((taskId) => data.tasks[taskId]);

                return (
                  <div key={column.id} className="flex flex-col bg-slate-100 dark:bg-slate-900/50 rounded-2xl w-80 shrink-0 max-h-full border border-slate-200 dark:border-slate-800">
                    <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                      <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        {column.title}
                        <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full">
                          {tasks.length}
                        </span>
                      </h3>
                    </div>

                    <Droppable droppableId={column.id}>
                      {(provided, snapshot) => (
                        <div
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className={`flex-1 p-3 overflow-y-auto space-y-3 transition-colors ${
                            snapshot.isDraggingOver ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''
                          }`}
                        >
                          {tasks.map((task, index) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`bg-white dark:bg-slate-800 p-4 rounded-xl border ${
                                    snapshot.isDragging
                                      ? 'border-indigo-500 shadow-xl shadow-indigo-500/20 rotate-2'
                                      : 'border-slate-200 dark:border-slate-700 shadow-sm'
                                  } transition-all`}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-md">
                                      {task.type}
                                    </span>
                                    {/* --- DELETE BUTTON --- */}
                                    <button 
                                      onClick={() => handleDelete(task.id, column.id)}
                                      className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                      title="Remove from board"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-2 leading-snug">
                                    {task.title}
                                  </h4>
                                  <div className="space-y-1.5 mt-3">
                                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">{task.org}</span>
                                    </p>
                                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                                      {task.country}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}