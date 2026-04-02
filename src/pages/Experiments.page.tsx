import { Container, Title, Text } from '@mantine/core';

export function ExperimentsPage() {
  return (
    <Container>
      <Title order={2} mt="md">Experiments</Title>
      <Text c="dimmed" mt="sm">Design and manage thin-film experiments here.</Text>
    </Container>
  );
}
