'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@rfjs/web-ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@rfjs/web-ui/components/dialog';
import { Input } from '@rfjs/web-ui/components/input';
import { Label } from '@rfjs/web-ui/components/label';

import { createAiClient } from '@/lib/ai/client';
import { loadAiSettings, saveAiSettings } from '@/lib/ai/settings';

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

export function AiSettingsDialog() {
  const t = useTranslations('AiSettings');
  const [open, setOpen] = React.useState(false);
  const [baseUrl, setBaseUrl] = React.useState('');
  const [apiKey, setApiKey] = React.useState('');
  const [model, setModel] = React.useState('');
  const [test, setTest] = React.useState<TestState>('idle');
  const [saved, setSaved] = React.useState(false);

  // 開啟時載入既有設定。
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    setTest('idle');
    setSaved(false);
    if (next) {
      const s = loadAiSettings();
      setBaseUrl(s?.baseUrl ?? '');
      setApiKey(s?.apiKey ?? '');
      setModel(s?.model ?? '');
    }
  };

  const onTest = async () => {
    setTest('testing');
    try {
      await createAiClient({ baseUrl, apiKey, model }).complete({
        system: 'You are a connectivity check.',
        user: 'Reply with the single word: ok',
        timeoutMs: 15_000,
      });
      setTest('ok');
    } catch {
      setTest('fail');
    }
  };

  const onSave = () => {
    saveAiSettings({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim() });
    setSaved(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('trigger')}>
          <Sparkles className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ai-base-url">{t('baseUrl')}</Label>
            <Input
              id="ai-base-url"
              value={baseUrl}
              placeholder={t('baseUrlPlaceholder')}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ai-api-key">{t('apiKey')}</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ai-model">{t('model')}</Label>
            <Input id="ai-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          {test === 'ok' ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('testOk')}</p> : null}
          {test === 'fail' ? (
            <p role="alert" className="text-sm text-fault">
              {t('testFail')}
            </p>
          ) : null}
          {saved ? <p className="text-sm text-muted-foreground">{t('saved')}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onTest} disabled={test === 'testing'}>
            {t('test')}
          </Button>
          <Button size="sm" onClick={onSave}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
