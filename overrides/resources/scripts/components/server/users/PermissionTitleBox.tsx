import React, { memo, useCallback } from 'react';
import { useField } from 'formik';
import TitledGreyBox from '@/components/elements/TitledGreyBox';
import tw from 'twin.macro';
import Input from '@/components/elements/Input';
import isEqual from 'react-fast-compare';
import i18n from '@/i18n';

interface Props {
    isEditable: boolean;
    title: string;
    permissions: string[];
    className?: string;
}

const PermissionTitleBox: React.FC<Props> = memo(({ isEditable, title, permissions, className, children }) => {
    const [{ value }, , { setValue }] = useField<string[]>('permissions');

    const onCheckboxClicked = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            if (event.currentTarget.checked) {
                setValue([...value, ...permissions.filter((permission) => !value.includes(permission))]);
            } else {
                setValue(value.filter((permission) => !permissions.includes(permission)));
            }
        },
        [permissions, value]
    );

    return (
        <TitledGreyBox
            title={
                <div css={tw`flex items-center`}>
                    <p css={tw`text-sm uppercase flex-1`}>
                        {i18n.t(`frontend:permissionGroup_${title}`, { defaultValue: title })}
                    </p>
                    {isEditable && (
                        <Input
                            type={'checkbox'}
                            aria-label={i18n.t('frontend:permissionSelectGroup', {
                                defaultValue: 'Select all permissions in this group',
                            })}
                            checked={permissions.every((permission) => value.includes(permission))}
                            onChange={onCheckboxClicked}
                        />
                    )}
                </div>
            }
            className={className}
        >
            {children}
        </TitledGreyBox>
    );
}, isEqual);

export default PermissionTitleBox;
