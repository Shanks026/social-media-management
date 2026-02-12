import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

export function CustomTable({ columns, data, isLoading, onRowClick }) {
  return (
    <div className="rounded-lg border bg-card/0 overflow-hidden">
      <Table>
        {/* COLGROUP: Defines the skeleton of the column widths */}
        <colgroup>
          {columns.map((col, index) => (
            <col key={`col-${index}`} style={{ width: col.width || 'auto' }} />
          ))}
        </colgroup>

        <TableHeader className="bg-muted/30">
          <TableRow>
            {columns.map((col, index) => (
              <TableHead key={index} className={col.headerClassName}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={columns.length} className="h-16 px-6">
                  <Skeleton className="h-4 w-full opacity-50" />
                </TableCell>
              </TableRow>
            ))
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            data.map((item) => (
              <TableRow
                key={item.id}
                className="group hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col, index) => (
                  <TableCell key={index} className={col.cellClassName}>
                    {col.render ? col.render(item) : item[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
