const API_KEYS = [
  '41720408-8a6a-4abc-b934-1c44e33719cc',
  '29475d12-d3ec-4b30-b457-529b85db312d',
  '6e526565-2246-4071-b302-6b18c3d73026',
  'f7177de2-a93b-4098-a252-9e92b4ac947b',
  '2c25b5d3-e66f-4e5a-98f6-07f17f26ed7f',
  '8f549a00-5f58-425d-95f8-6347a0e3eb36',
  'd4374957-910d-4509-b195-0be07c0dfa84',
  'bfd9db73-3447-443e-b47c-d6926d8b5579',
  'd4374957-910d-4509-b195-0be07c0dfa84',
];

function getRandomApiKey(): string {
  const index = Math.floor(Math.random() * API_KEYS.length);
  return API_KEYS[index];
}

export async function fetchTransactions(address: string) {
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions`;
  const apiKey = getRandomApiKey();

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'TRON-PRO-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Transactions:', data);
    return data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
  }
}
