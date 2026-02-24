import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AdminPagination from '../AdminPagination';

describe('AdminPagination', () => {
  it('disables previous on first page and calls next handler', async () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <AdminPagination
        page={1}
        pageSize={25}
        itemCount={25}
        hasNextPage={true}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    const prevButton = screen.getByRole('button', { name: /prev/i });
    const nextButton = screen.getByRole('button', { name: /next/i });

    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    await userEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('changes page size', async () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <AdminPagination
        page={2}
        pageSize={25}
        itemCount={25}
        hasNextPage={false}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    );

    const select = screen.getByRole('combobox');
    await userEvent.selectOptions(select, '50');

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});
