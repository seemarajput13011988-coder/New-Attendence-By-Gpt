
import { auth, db } from './firebase.js';

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

import {
  ref, get, onValue, push, set, update, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

const $ = id => document.getElementById(id);

let unsub = [];
let employees = {};
let tasksCache = {};
let requestsCache = {};

$('signIn').onclick = async () => {
  try {
    $('loginError').textContent = '';
    await signInWithEmailAndPassword(
      auth, $('email').value, $('password').value
    );
  } catch (e) {
    $('loginError').textContent = 'Sign in failed.';
  }
};

$('signOut').onclick = () => signOut(auth);

for (const button of document.querySelectorAll('.nav')) {
  button.onclick = () => {
    const page = button.dataset.page;

    document.querySelectorAll('.page').forEach(el => {
      el.classList.toggle('hidden', el.id !== page);
    });

    document.querySelectorAll('.nav').forEach(el => {
      el.classList.toggle('bg-indigo-600', el === button);
    });

    $('pageTitle').textContent =
      page[0].toUpperCase() + page.slice(1);
  };
}

function makeRow(text) {
  const el = document.createElement('div');
  el.className = 'border-b py-3';
  el.textContent = text;
  return el;
}

onAuthStateChanged(auth, async user => {
  unsub.forEach(fn => fn());
  unsub = [];

  if (!user) {
    $('login').classList.remove('hidden');
    $('dashboard').classList.add('hidden');
    return;
  }

  try {
    const profile = (
      await get(ref(db, `profiles/${user.uid}`))
    ).val();

    if (profile?.role !== 'admin') {
      await signOut(auth);
      $('loginError').textContent = 'Admin access required.';
      return;
    }

    $('login').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
    $('adminEmail').textContent = user.email;

    unsub.push(onValue(ref(db, 'profiles'), snap => {
      employees = Object.fromEntries(
        Object.entries(snap.val() || {})
          .filter(([, p]) => p.role === 'employee')
      );

      $('employeeCount').textContent =
        Object.keys(employees).length;

      $('employeeList').replaceChildren();
      $('assignee').replaceChildren(
        new Option('Select employee', '')
      );

      for (const [uid, profile] of Object.entries(employees)) {
        $('employeeList').append(
          makeRow(`${profile.name || uid} · ${profile.team || 'Unassigned'}`)
        );

        $('assignee').add(
          new Option(profile.name || uid, uid)
        );
      }

      renderTaskReviews();
    }));

    unsub.push(onValue(ref(db, 'tasks'), snap => {
      tasksCache = snap.val() || {};
      $('taskCount').textContent =
        Object.keys(tasksCache).length;
      renderTaskReviews();
    }));

    unsub.push(onValue(ref(db, 'taskRequests'), snap => {
      requestsCache = snap.val() || {};
      renderTaskReviews();
    }));

    unsub.push(onValue(ref(db, 'shifts'), snap => {
      let active = 0;
      const rows = [];

      for (const [uid, records] of Object.entries(snap.val() || {})) {
        for (const [id, shift] of Object.entries(records || {})) {
          if (shift.status === 'active') active++;

          const date = shift.startedAt
            ? new Date(shift.startedAt).toLocaleString(
                'en-IN', { timeZone: 'Asia/Kolkata' }
              )
            : 'Pending';

          rows.push(
            makeRow(
              `${employees[uid]?.name || uid} · ${shift.status} · ${date}`
            )
          );
        }
      }

      $('activeCount').textContent = active;
      $('attendanceList').replaceChildren(...rows);
    }));

  } catch (e) {
    $('loginError').textContent =
      'Unable to verify admin access. Check Firebase rules.';
  }
});

$('taskForm').onsubmit = async event => {
  event.preventDefault();

  try {
    $('actionError').textContent = '';

    await set(push(ref(db, 'tasks')), {
      title: $('taskTitle').value.trim(),
      description: $('taskDescription').value.trim(),
      assigneeUid: $('assignee').value,
      status: 'Assigned',
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    $('taskForm').reset();

  } catch (e) {
    $('actionError').textContent =
      'Unable to assign task. Check permissions.';
  }
};

function renderTaskReviews() {
  const box = $('taskList');
  box.replaceChildren();

  for (const [id, task] of Object.entries(tasksCache)) {
    const card = document.createElement('article');
    card.className = 'border rounded-xl p-4 mb-3';

    const heading = document.createElement('h3');
    heading.className = 'font-bold';
    heading.textContent = task.title;

    const meta = document.createElement('p');
    meta.className = 'text-slate-500 text-xs mt-1';
    meta.textContent =
      `${employees[task.assigneeUid]?.name || task.assigneeUid} · ${task.status || 'Assigned'}`;

    card.append(heading, meta);

    const requests = Object.entries(
      requestsCache[task.assigneeUid] || {}
    )
      .filter(([, request]) => request.taskId === id)
      .sort((a, b) =>
        (b[1].createdAt || 0) - (a[1].createdAt || 0)
      );

    for (const [requestId, request] of requests) {
      const line = document.createElement('div');
      line.className = 'mt-3 border-t pt-3';

      const description = document.createElement('p');
      description.className = 'text-xs';

      const date = request.createdAt
        ? new Date(request.createdAt).toLocaleString(
            'en-IN', { timeZone: 'Asia/Kolkata' }
          )
        : 'Pending timestamp';

      description.textContent =
        `${request.kind === 'complete' ? 'Completion' : 'Start'} request · ` +
        `${request.state || 'pending'} · ` +
        `${request.notes || 'No notes'} · ${date}`;

      line.append(description);

      if (request.state === 'pending') {
        const buttons = document.createElement('div');
        buttons.className = 'flex gap-2 mt-2';

        const actions = [
          [
            'Approve',
            request.kind === 'complete' ? 'Approved' : 'In Progress',
            'bg-emerald-600'
          ],
          [
            'Return for rework',
            'Rework Required',
            'bg-amber-600'
          ]
        ];

        for (const [label, status, css] of actions) {
          const button = document.createElement('button');
          button.textContent = label;
          button.className =
            `${css} text-white rounded-lg px-3 py-2 text-xs`;

          button.onclick = async () => {
            button.disabled = true;

            try {
              await update(ref(db), {
                [`tasks/${id}/status`]: status,
                [`tasks/${id}/reviewedAt`]: serverTimestamp(),
                [`tasks/${id}/reviewedBy`]: auth.currentUser.uid,
                [`taskRequests/${task.assigneeUid}/${requestId}/state`]:
                  status === 'Rework Required'
                    ? 'rejected'
                    : 'approved',
                [`taskRequests/${task.assigneeUid}/${requestId}/reviewedAt`]:
                  serverTimestamp(),
                [`taskRequests/${task.assigneeUid}/${requestId}/reviewedBy`]:
                  auth.currentUser.uid
              });

              $('reviewFeedback').textContent = 'Review saved.';

            } catch (e) {
              $('reviewFeedback').textContent =
                'Review failed. Check database rules.';
            } finally {
              button.disabled = false;
            }
          };

          buttons.append(button);
        }

        line.append(buttons);
      }

      card.append(line);
    }

    box.append(card);
  }

  if (!Object.keys(tasksCache).length) {
    box.textContent = 'No tasks yet.';
  }
}
