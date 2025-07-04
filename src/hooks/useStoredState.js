import { useState, useEffect } from 'react';

export const useStoredState = (key, initialValue) => {
  const [value, setValue] = useState(initialValue);
  // Nova variável de estado para controlar se o carregamento inicial já ocorreu
  const [isLoaded, setIsLoaded] = useState(false);

  // Efeito para CARREGAR os dados quando o componente é montado
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.loadData().then(storedData => {
        if (storedData && storedData[key] !== undefined) {
          setValue(storedData[key]);
        }
        // Marca que o carregamento foi concluído, mesmo se não houver arquivo
        setIsLoaded(true);
      });
    } else {
      // Fallback para o navegador
      try {
        const item = window.localStorage.getItem(key);
        if (item) {
          setValue(JSON.parse(item));
        }
      } catch (error) {
        console.error('Erro ao ler do localStorage', error);
      }
      // Marca que o carregamento foi concluído no modo navegador
      setIsLoaded(true);
    }
  }, [key]); // Roda apenas uma vez

  // Efeito para SALVAR os dados sempre que o valor mudar
  useEffect(() => {
    // Apenas executa a lógica de salvamento SE o carregamento inicial já tiver terminado
    if (!isLoaded) {
      return;
    }

    const saveData = async () => {
      if (window.electronAPI) {
        const allData = await window.electronAPI.loadData() || {};
        const newData = { ...allData, [key]: value };
        await window.electronAPI.saveData(newData);
      } else {
        // Fallback para o navegador
        try {
          window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
          console.error('Erro ao salvar no localStorage:', error);
        }
      }
    };

    saveData();

  }, [key, value, isLoaded]); // Agora depende de 'isLoaded'

  return [value, setValue];
};
