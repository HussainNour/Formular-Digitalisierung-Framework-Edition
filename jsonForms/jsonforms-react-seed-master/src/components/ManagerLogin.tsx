// src/components/ManagerLogin.tsx
import { useEffect, useState } from 'react';
import { Box, Button, TextField, Alert, Stack, Typography } from '@mui/material';
import { setToken } from '../auth';

const API = 'http://localhost:5050';

export default function ManagerLogin() {
  const [username, setU] = useState('manager');
  const [password, setP] = useState('1234');
  const [status, setStatus] = useState<'idle'|'error'>('idle');
  const [info, setInfo] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const msg = params.get('msg');
    if (msg === 'session_expired') setInfo('Deine Sitzung ist abgelaufen. Bitte erneut einloggen.');
    if (msg === 'auth_required') setInfo('Bitte anmelden, um fortzufahren.');
  }, []);

  const doLogin = async () => {
    setStatus('idle');
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('login');
      const json = await res.json();
      setToken(json.token);
      window.location.href = '/';
    } catch {
      setStatus('error');
    }
  };

  return (
    <Box sx={{ maxWidth: 360, mx: 'auto', mt: 6, p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Manager Login</Typography>
      <Stack spacing={2}>
        {info && <Alert severity="info">{info}</Alert>}
        <TextField label="Username" value={username} onChange={e=>setU(e.target.value)} />
        <TextField label="Passwort" type="password" value={password} onChange={e=>setP(e.target.value)} />
        <Button variant="contained" onClick={doLogin}>Einloggen</Button>
        {status==='error' && <Alert severity="error">Login fehlgeschlagen.</Alert>}
      </Stack>
    </Box>
  );
}
