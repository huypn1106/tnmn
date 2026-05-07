import { useEffect, useRef } from 'react';

export function useWorkerInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      const blob = new Blob([`
        let timer = null;
        self.onmessage = function(e) {
          if (e.data.command === 'start') {
            timer = setInterval(() => self.postMessage('tick'), e.data.delay);
          } else if (e.data.command === 'stop') {
            clearInterval(timer);
          }
        };
      `], { type: 'application/javascript' });
      
      const worker = new Worker(URL.createObjectURL(blob));
      
      worker.onmessage = () => {
        savedCallback.current();
      };
      
      worker.postMessage({ command: 'start', delay });
      
      return () => {
        worker.postMessage({ command: 'stop' });
        worker.terminate();
      };
    }
  }, [delay]);
}
