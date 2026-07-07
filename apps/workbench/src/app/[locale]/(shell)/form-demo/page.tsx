'use client';

import { ConfigForm } from '@rfjs/form-builder-ui';
import type { FormConfig } from '@rfjs/form-builder';

const demoConfig: FormConfig = {
  version: 1,
  fields: [
    { key: 'name', label: 'Name', component: 'Input', dataType: 'string', required: true },
    {
      key: 'role',
      label: 'Role',
      component: 'Select',
      dataType: 'string',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
      ],
    },
    { key: 'dob', label: 'Date of birth', component: 'Date', dataType: 'date' },
    { key: 'agree', label: 'I agree', component: 'Checkbox', dataType: 'boolean' },
    { key: 'bio', label: 'Bio', component: 'Textarea', dataType: 'string' },
  ],
};

export default function FormDemoPage() {
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-lg font-semibold">ConfigForm demo</h1>
      <ConfigForm config={demoConfig} onSubmit={(values) => console.log('submit', values)} />
    </div>
  );
}
