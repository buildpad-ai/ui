/**
 * Field labels follow VForm's `locale`.
 *
 * getFormFields named every field with its FIRST meta.translations entry and
 * FormField takes that name over its own locale-aware lookup, so `locale`
 * changed nothing: an Indonesian page showed the English label.
 */
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

jest.mock('../components/interface-components', () =>
    require('./helpers/leafProbe').makeInterfacesMock());
jest.mock('@buildpad/utils', () => ({
    ...jest.requireActual('@buildpad/utils'),
    getFieldInterface: () => ({ type: 'input', props: {} }),
}));

import { resetProbe } from './helpers/leafProbe';
import { VForm } from '../VForm';
import { getFormFields } from '../utils/get-form-fields';

const title: any = {
    collection: 'articles',
    field: 'title',
    type: 'string',
    schema: {},
    meta: {
        sort: 1,
        translations: [
            { language: 'en-US', translation: 'Headline' },
            { language: 'id-ID', translation: 'Judul' },
        ],
    },
};

beforeEach(resetProbe);

describe('VForm — field labels and locale', () => {
    it('labels a field with the translation of its locale', () => {
        render(
            <MantineProvider>
                <VForm fields={[title]} locale="id" enforcePermissions={false} />
            </MantineProvider>,
        );
        expect(screen.getByText('Judul')).toBeInTheDocument();
        expect(screen.queryByText('Headline')).not.toBeInTheDocument();
    });

    it('keeps the first translation without a locale', () => {
        render(
            <MantineProvider>
                <VForm fields={[title]} enforcePermissions={false} />
            </MantineProvider>,
        );
        expect(screen.getByText('Headline')).toBeInTheDocument();
    });

    it('getFormFields names fields for the locale it is given', () => {
        expect(getFormFields([title], undefined, 'id-ID')[0].name).toBe('Judul');
        expect(getFormFields([title], undefined, 'en')[0].name).toBe('Headline');
        expect(getFormFields([title])[0].name).toBe('Headline');
    });
});
