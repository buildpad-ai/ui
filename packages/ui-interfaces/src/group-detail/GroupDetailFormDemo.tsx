import React, { useState } from 'react';
import {
  MantineProvider,
  Container,
  Title,
  TextInput,
  Select,
  Button,
  Stack,
  Group,
  Paper,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { GroupDetail } from './GroupDetail';

// Demo showing how group-detail works in a form context
export function GroupDetailFormDemo() {
  const form = useForm({
    initialValues: {
      // User fields
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: 'user',
      
      // Address fields (grouped)
      address: '123 Main St',
      city: 'New York',
      country: 'USA',
      zipCode: '10001',
      
      // Company fields (grouped)
      companyName: 'Acme Corp',
      department: 'Engineering',
      position: 'Developer',
    },
  });

  const [initialValues] = useState(form.values);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);

  // Simulate validation
  const validateForm = () => {
    const errors = [];
    if (!form.values.email.includes('@')) {
      errors.push({
        field: 'email',
        code: 'INVALID_FORMAT',
        type: 'invalid',
        message: 'Invalid email format'
      });
    }
    if (form.values.firstName.length < 2) {
      errors.push({
        field: 'firstName',
        code: 'TOO_SHORT',
        type: 'minimum_length',
        message: 'First name is too short'
      });
    }
    setValidationErrors(errors);
  };

  // Define field configurations for grouped fields
  const addressFields = [
    { field: 'address', name: 'Address' },
    { field: 'city', name: 'City' },
    { field: 'country', name: 'Country' },
    { field: 'zipCode', name: 'ZIP Code' },
  ];

  const companyFields = [
    { field: 'companyName', name: 'Company Name' },
    { field: 'department', name: 'Department' },
    { field: 'position', name: 'Position' },
  ];

  const handleSubmit = (_values: any) => {
    // Handle form submission
    // In a real app, you would submit to your API here
  };

  return (
    <MantineProvider>
      <Container size="md" py="xl">
        <Paper p="md" withBorder>
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="lg">
              <Title order={2}>Group Detail Form Demo</Title>

              {/* Individual fields (not grouped) */}
              <Stack gap="md">
                <Group grow>
                  <TextInput
                    label="First Name"
                    {...form.getInputProps('firstName')}
                    required
                  />
                  <TextInput
                    label="Last Name"
                    {...form.getInputProps('lastName')}
                    required
                  />
                </Group>
                
                <TextInput
                  label="Email"
                  type="email"
                  {...form.getInputProps('email')}
                  required
                />
                
                <Select
                  label="Role"
                  {...form.getInputProps('role')}
                  data={[
                    { value: 'admin', label: 'Administrator' },
                    { value: 'user', label: 'User' },
                    { value: 'guest', label: 'Guest' },
                  ]}
                />
              </Stack>

              {/* Address Information Group */}
              <GroupDetail
                field={{ name: 'Address Information' }}
                fields={addressFields}
                values={form.values}
                initialValues={initialValues}
                validationErrors={validationErrors.filter(e => 
                  addressFields.some(f => f.field === e.field)
                )}
                start="closed"
                headerIcon="location_on"
                headerColor="var(--ds-success, #059669)"
                badge="Optional"
                onChange={(groupValues) => {
                  // Update form values for address fields
                  Object.keys(groupValues).forEach(fieldName => {
                    if (addressFields.some(f => f.field === fieldName)) {
                      form.setFieldValue(fieldName, groupValues[fieldName]);
                    }
                  });
                }}
              >
                <Stack gap="md">
                  <TextInput
                    label="Address"
                    {...form.getInputProps('address')}
                  />
                  
                  <Group grow>
                    <TextInput
                      label="City"
                      {...form.getInputProps('city')}
                    />
                    <TextInput
                      label="ZIP Code"
                      {...form.getInputProps('zipCode')}
                    />
                  </Group>
                  
                  <Select
                    label="Country"
                    {...form.getInputProps('country')}
                    data={[
                      { value: 'USA', label: 'United States' },
                      { value: 'CAN', label: 'Canada' },
                      { value: 'UK', label: 'United Kingdom' },
                      { value: 'FRA', label: 'France' },
                    ]}
                  />
                </Stack>
              </GroupDetail>

              {/* Company Information Group */}
              <GroupDetail
                field={{ name: 'Company Information' }}
                fields={companyFields}
                values={form.values}
                initialValues={initialValues}
                validationErrors={validationErrors.filter(e => 
                  companyFields.some(f => f.field === e.field)
                )}
                start="open"
                headerIcon="business"
                headerColor="var(--ds-secondary, #7c3aed)"
                onChange={(groupValues) => {
                  // Update form values for company fields
                  Object.keys(groupValues).forEach(fieldName => {
                    if (companyFields.some(f => f.field === fieldName)) {
                      form.setFieldValue(fieldName, groupValues[fieldName]);
                    }
                  });
                }}
              >
                <Stack gap="md">
                  <TextInput
                    label="Company Name"
                    {...form.getInputProps('companyName')}
                  />
                  
                  <Group grow>
                    <TextInput
                      label="Department"
                      {...form.getInputProps('department')}
                    />
                    <TextInput
                      label="Position"
                      {...form.getInputProps('position')}
                    />
                  </Group>
                </Stack>
              </GroupDetail>

              {/* Form Actions */}
              <Group mt="xl">
                <Button type="submit">
                  Submit Form
                </Button>
                <Button onClick={validateForm} color="red" variant="outline">
                  Validate
                </Button>
                <Button 
                  onClick={() => {
                    form.reset();
                    setValidationErrors([]);
                  }} 
                  variant="outline"
                >
                  Reset
                </Button>
              </Group>

              {/* Current Form State */}
              <Title order={4} mt="xl">Current Form Data:</Title>
              <pre style={{ 
                background: 'var(--mantine-color-gray-0)', 
                padding: '1rem', 
                borderRadius: 'var(--mantine-radius-sm)',
                fontSize: '0.875rem',
                overflow: 'auto'
              }}>
                {JSON.stringify(form.values, null, 2)}
              </pre>
            </Stack>
          </form>
        </Paper>
      </Container>
    </MantineProvider>
  );
}

export default GroupDetailFormDemo;
