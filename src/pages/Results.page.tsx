import { Container, Title, Text } from '@mantine/core';

export function ResultsPage() {
  return (
    <Container>
      <Title order={2} mt="md">Results</Title>
      <Text c="dimmed" mt="sm">View experiment results here.</Text>
    </Container>
  );
}
