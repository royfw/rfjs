import { describe, it, expect } from 'vitest';
import { getConnectionStringInfo } from './connection-string';

describe('getConnectionStringInfo', () => {
  it('should return defaults when no schema info is present', () => {
    const cs = 'postgres://user:pass@localhost:5432/db';
    const result = getConnectionStringInfo(cs);
    expect(result.finalSchema).toBe('public');
    expect(result.hasSearchPath).toBe(false);
    expect(result.finalConnectionString).toBe(cs);
  });

  it('should parse schema from options search_path', () => {
    const cs =
      'postgres://user:pass@localhost:5432/db?options=-c%20search_path%3Dmyschema';
    const result = getConnectionStringInfo(cs);
    expect(result.finalSchema).toBe('myschema');
    expect(result.hasSearchPath).toBe(true);

    const params = new URL(result.finalConnectionString).searchParams;
    expect(params.get('options')).toContain('-c search_path=myschema');
  });

  it('should parse schema from schema param', () => {
    const cs = 'postgres://user:pass@localhost:5432/db?schema=otherschema';
    const result = getConnectionStringInfo(cs);
    expect(result.finalSchema).toBe('otherschema');
    expect(result.hasSearchPath).toBe(false);

    const params = new URL(result.finalConnectionString).searchParams;
    expect(params.get('options')).toContain('-c search_path=otherschema');
  });

  it('should prioritize options search_path over schema param', () => {
    const cs =
      'postgres://user:pass@localhost:5432/db?schema=ignored&options=-c search_path=preferred';
    const result = getConnectionStringInfo(cs);
    expect(result.finalSchema).toBe('preferred');
    expect(result.hasSearchPath).toBe(true);
  });

  it('should use targetSchema if no other schema info present', () => {
    const cs = 'postgres://user:pass@localhost:5432/db';
    const result = getConnectionStringInfo(cs, 'target');
    expect(result.finalSchema).toBe('target');
    expect(result.hasSearchPath).toBe(false);

    const params = new URL(result.finalConnectionString).searchParams;
    expect(params.get('options')).toContain('-c search_path=target');
  });

  it('should properly merging options when adding search path', () => {
    const cs =
      'postgres://user:pass@localhost:5432/db?options=-c%20log_min_messages%3Ddebug';
    const result = getConnectionStringInfo(cs, 'target');
    expect(result.finalSchema).toBe('target');

    const params = new URL(result.finalConnectionString).searchParams;
    const options = params.get('options') || '';
    expect(options).toContain('-c log_min_messages=debug');
    expect(options).toContain('-c search_path=target');
  });

  it('does not throw on a libpq keyword/value DSN (non-URL)', () => {
    const cs = 'host=localhost port=5432 dbname=app';
    const result = getConnectionStringInfo(cs, 'myschema');
    expect(result.finalSchema).toBe('myschema');
    expect(result.optionsSchemas).toEqual([]);
    expect(result.hasSearchPath).toBe(false);
    // a non-URL DSN cannot have options injected; it is returned unchanged
    expect(result.finalConnectionString).toBe(cs);
  });

  it('does not throw on an empty connection string', () => {
    const result = getConnectionStringInfo('');
    expect(result.finalSchema).toBe('public');
    expect(result.hasSearchPath).toBe(false);
    expect(result.finalConnectionString).toBe('');
  });
});
